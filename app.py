import logging
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import pandas as pd
import requests
from io import BytesIO
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from openpyxl import Workbook
from openpyxl.chart import ScatterChart, Reference, Series
from openpyxl.drawing.image import Image as OpenpyxlImage
from openpyxl.styles import Font, Alignment, Border, Side
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as ReportlabImage
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from bidi.algorithm import get_display

# --- FONT HANDLING ---
VAZIRMATN_FONT_URL = 'https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/fonts/ttf/Vazirmatn-Regular.ttf'
VAZIRMATN_FONT_PATH = 'Vazirmatn-Regular.ttf'
try:
    # Download and register the font for ReportLab
    response = requests.get(VAZIRMATN_FONT_URL)
    response.raise_for_status()
    with open(VAZIRMATN_FONT_PATH, 'wb') as f:
        f.write(response.content)
    pdfmetrics.registerFont(TTFont('Vazirmatn', VAZIRMATN_FONT_PATH))
    FONT_AVAILABLE = True
except Exception as e:
    logging.error(f"Could not download or register Vazirmatn font: {e}")
    FONT_AVAILABLE = False

# Configure basic logging
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app)


# --- ANALYSIS LOGIC (from previous steps, unchanged) ---
def generate_analysis_text(summary_stats, sample_type):
    cu = summary_stats.get('Cu')
    cc = summary_stats.get('Cc')
    std_dev = summary_stats.get('std_dev_geotechnical')
    fm = summary_stats.get('fineness_modulus')
    lines = ["<strong>تحلیل دانه‌بندی (Gradation):</strong>"]
    if cu is not None and cc is not None:
        if cu >= 4 and 1 <= cc <= 3: lines.append(f"<li>مقادیر Cu ({cu:.2f}) و Cc ({cc:.2f}) نشان‌دهنده یک خاک <strong>خوب دانه‌بندی شده (Well-Graded)</strong> است.</li>")
        else: lines.append(f"<li>مقادیر Cu ({cu:.2f}) و Cc ({cc:.2f}) نشان‌دهنده یک خاک <strong>بد دانه‌بندی شده (Poorly-Graded)</strong> است.</li>")
    else: lines.append("<li>مقادیر Cu و Cc برای تعیین دقیق نوع دانه‌بندی کافی نبود.</li>")
    lines.append("<br><strong>تحلیل یکنواختی (Sorting):</strong>")
    if std_dev is not None: lines.append(f"<li>انحراف معیار نمونه برابر با <strong>{std_dev:.2f} میکرون</strong> است.</li>")
    else: lines.append("<li>انحراف معیار قابل محاسبه نبود.</li>")
    specific_text = ''
    if sample_type == 'concrete' and fm is not None:
        specific_text = f'<strong>تحلیل سنگدانه بتن:</strong> مدول نرمی (FM) <strong>{fm:.2f}</strong> محاسبه شد. '
        if 2.3 <= fm <= 3.1: specific_text += 'این مقدار در بازه استاندارد (2.3 تا 3.1) برای ماسه بتن قرار دارد.'
        else: specific_text += 'این مقدار خارج از بازه استاندارد است.'
    return {"general_analysis": "\n".join(lines), "specific_analysis": specific_text}

def calculate_fineness_modulus(df):
    fm_sieve_sizes = pd.DataFrame({'standard_size': [9500, 4750, 2360, 1180, 600, 300, 150]})
    df_sorted = df.dropna(subset=['size']).sort_values('size')
    fm_sieves_data = pd.merge_asof(fm_sieve_sizes, df_sorted[['size', 'cumulative_retained']], left_on='standard_size', right_on='size', direction='nearest')
    sum_cum_retained = fm_sieves_data['cumulative_retained'].sum()
    return sum_cum_retained / 100 if sum_cum_retained > 0 else None

def perform_sieve_analysis(sieves_data, sample_type):
    df = pd.DataFrame(sieves_data).sort_values(by='size', ascending=False, na_position='last').reset_index(drop=True)
    df['weight'] = pd.to_numeric(df['weight'], errors='coerce').fillna(0)
    df['size'] = pd.to_numeric(df['size'], errors='coerce')
    total_weight = df['weight'].sum()
    if total_weight == 0: raise ValueError("Total weight cannot be zero.")
    df['percent_retained'] = (df['weight'] / total_weight) * 100
    df['cumulative_retained'] = df['percent_retained'].cumsum()
    df['percent_passing'] = (100 - df['cumulative_retained']).clip(lower=0)
    interp_df = df.dropna(subset=['size'])
    known_percents = interp_df['percent_passing'].values[::-1]
    known_log_sizes = np.log(interp_df['size'].values[::-1])
    target_percents = np.array([10, 16, 30, 50, 60, 84])
    log_d_values = np.interp(target_percents, known_percents, known_log_sizes, left=np.nan, right=np.nan)
    d_values = {f'd{p}': val if not np.isnan(val) else None for p, val in zip(target_percents, np.exp(log_d_values))}
    d10, d16, d30, d60, d84 = (d_values.get(f'd{d}') for d in [10, 16, 30, 60, 84])
    cu = d60 / d10 if d10 and d60 and d10 > 0 else None
    cc = (d30**2) / (d10 * d60) if d10 and d30 and d60 and d10 > 0 and d60 > 0 else None
    std_dev = (d84 - d16) / 2 if d16 and d84 else None
    fineness_modulus = calculate_fineness_modulus(df) if sample_type == 'concrete' else None
    summary = {'d_values': {k: v for k, v in d_values.items() if v is not None and k not in ['d16', 'd84']}, 'Cu': cu, 'Cc': cc, 'total_weight': total_weight, 'std_dev_geotechnical': std_dev, 'fineness_modulus': fineness_modulus}
    return {'results_table': df.to_dict(orient='records'), 'summary_stats': summary}


# --- CHARTING ---
def create_passing_chart_image(analysis_data):
    """Generates a passing curve chart using Matplotlib and returns it as a BytesIO buffer."""
    df = pd.DataFrame(analysis_data['results_table']).dropna(subset=['size'])
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(df['size'], df['percent_passing'], marker='o', linestyle='-', color='b')
    ax.set_xscale('log')
    ax.set_xlabel('Sieve Size (microns) - Log Scale')
    ax.set_ylabel('Percent Passing (%)')
    ax.set_title('Gradation Curve')
    ax.grid(True, which="both", ls="--")
    buf = BytesIO()
    fig.savefig(buf, format='png', dpi=150)
    plt.close(fig)
    buf.seek(0)
    return buf


# --- EXCEL REPORT ---
def create_excel_report(analysis_data):
    wb = Workbook()
    summary_ws = wb.active
    summary_ws.title = "Summary"
    summary_ws.sheet_view.rightToLeft = True

    headers = ["پارامتر", "مقدار"]
    summary_ws.append(headers)

    stats = analysis_data['summary_stats']
    summary_data = [
        ("D10 (µm)", stats['d_values'].get('d10')), ("D30 (µm)", stats['d_values'].get('d30')),
        ("D50 (µm)", stats['d_values'].get('d50')), ("D60 (µm)", stats['d_values'].get('d60')),
        ("ضریب یکنواختی (Cu)", stats.get('Cu')), ("ضریب انحنا (Cc)", stats.get('Cc')),
        ("انحراف معیار (µm)", stats.get('std_dev_geotechnical')), ("مدول نرمی (FM)", stats.get('fineness_modulus')),
        ("وزن کل (g)", stats.get('total_weight'))
    ]
    for row_data in summary_data:
        if row_data[1] is not None:
            summary_ws.append([row_data[0], round(row_data[1], 2) if isinstance(row_data[1], (int, float)) else row_data[1]])

    # --- Data Sheet ---
    data_ws = wb.create_sheet(title="Data")
    data_ws.sheet_view.rightToLeft = True
    data_headers = ["سرند", "اندازه (µm)", "وزن (g)", "درصد مانده", "تجمعی مانده", "درصد عبوری"]
    data_ws.append(data_headers)
    for row in analysis_data['results_table']:
        data_ws.append([row['label'], row['size'], row['weight'], row['percent_retained'], row['cumulative_retained'], row['percent_passing']])

    # --- Add Chart ---
    chart_img_buf = create_passing_chart_image(analysis_data)
    img = OpenpyxlImage(chart_img_buf)
    img.anchor = 'J2'
    summary_ws.add_image(img)

    excel_buf = BytesIO()
    wb.save(excel_buf)
    excel_buf.seek(0)
    return excel_buf


# --- PDF REPORT ---
def p_text(text):
    """Helper for Persian text in ReportLab."""
    return Paragraph(get_display(text), style_sheet['Persian'])

def create_pdf_report(analysis_data):
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
    story = []

    # Styles
    global style_sheet
    from reportlab.lib.styles import getSampleStyleSheet
    style_sheet = getSampleStyleSheet()
    font_name = 'Vazirmatn' if FONT_AVAILABLE else 'Helvetica'
    style_sheet.add(ParagraphStyle(name='Persian', fontName=font_name, fontSize=10, leading=14, alignment=2))
    style_sheet.add(ParagraphStyle(name='TitlePersian', parent='Persian', fontSize=18, alignment=1))

    # Content
    story.append(p_text('گزارش تحلیل سرندی'))
    story.append(Spacer(1, 12))

    chart_img_buf = create_passing_chart_image(analysis_data)
    story.append(ReportlabImage(chart_img_buf, width=450, height=280))
    story.append(Spacer(1, 24))

    stats = analysis_data['summary_stats']
    summary_data = [[p_text("مقدار"), p_text("پارامتر")]]
    summary_items = [
        ("D10 (µm)", stats['d_values'].get('d10')), ("D30 (µm)", stats['d_values'].get('d30')),
        ("D50 (µm)", stats['d_values'].get('d50')), ("D60 (µm)", stats['d_values'].get('d60')),
        ("Cu", stats.get('Cu')), ("Cc", stats.get('Cc')),
        ("Std Dev (µm)", stats.get('std_dev_geotechnical')), ("FM", stats.get('fineness_modulus')),
        ("Total Weight (g)", stats.get('total_weight'))
    ]
    for name, val in summary_items:
        if val is not None:
            summary_data.append([f"{val:.2f}" if isinstance(val, (int, float)) else val, p_text(name)])

    summary_table = Table(summary_data, colWidths=[100, 200])
    summary_table.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER'), ('FONTNAME', (0,0), (-1,-1), font_name), ('GRID', (0,0), (-1,-1), 1, colors.black)]))
    story.append(summary_table)

    doc.build(story)
    buf.seek(0)
    return buf


# --- API ENDPOINTS ---
@app.route('/')
def index(): return "Python backend server is running!"

@app.route('/analyze', methods=['POST'])
def analyze_sieve_data_endpoint():
    data = request.get_json()
    sieves_data = data['sieves']
    sample_type = data.get('sample_type', 'default')
    analysis_results = perform_sieve_analysis(sieves_data, sample_type)
    analysis_results['analysis_text'] = generate_analysis_text(analysis_results['summary_stats'], sample_type)
    return jsonify(analysis_results)

@app.route('/export/excel', methods=['POST'])
def export_excel():
    analysis_data = request.get_json()
    excel_buf = create_excel_report(analysis_data)
    return send_file(excel_buf, download_name="sieve_analysis.xlsx", as_attachment=True, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@app.route('/export/pdf', methods=['POST'])
def export_pdf():
    analysis_data = request.get_json()
    pdf_buf = create_pdf_report(analysis_data)
    return send_file(pdf_buf, download_name="sieve_analysis_report.pdf", as_attachment=True, mimetype='application/pdf')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
