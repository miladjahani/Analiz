// cv-worker.js - Web Worker برای پردازش تصویر با OpenCV.js (نسخه حرفه‌ای)

// 1. Import OpenCV.js
self.importScripts('https://docs.opencv.org/4.9.0/opencv.js');

// حداقل مساحت کانتور بر حسب پیکسل. افزایش این عدد نویز کوچک را حذف می کند.
const MIN_PARTICLE_AREA = 50;
// حداقل معیار گردی (Circularity). دایره کامل 1.0 است. این معیار اشکال خطی را فیلتر می کند.
const MIN_CIRCULARITY = 0.1;

self.onmessage = function(e) {
    const { imageData, refDiameter, mode, refPixelLength, manualLine } = e.data;

    // اطمینان از آماده بودن OpenCV.js
    const cvReady = new Promise((resolve) => {
        if (self.cv) resolve();
        else self.onCvReady = resolve;
    });

    cvReady.then(() => {
        try {
            // ایجاد ماتریکس منبع (Source Matrix) از داده های تصویر
            const src = cv.matFromImageData(imageData);
            let displayMat = src.clone();
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

            // --- 1. پیش پردازش پیشرفته ---
            
            // الف) بهبود کنتراست موضعی با CLAHE
            // این روش کنتراست را در مناطق کوچک افزایش می دهد و نورپردازی غیر یکنواخت را جبران می کند.
            let clahe = new cv.CLAHE();
            clahe.setClipLimit(3.0); // محدودیت کنتراست بالاتر برای تصاویر با کنتراست کم
            clahe.setTilesGridSize(new cv.Size(8, 8)); 
            clahe.apply(gray, gray);
            clahe.delete();

            // ب) فیلتر میانی (Median Blur)
            // بسیار موثرتر از Gaussian Blur برای حذف نویز "نمک و فلفل" و حفظ لبه ها
            cv.medianBlur(gray, gray, 5); 

            let pixelsPerMm = 0;
            let refCircle = null;

            // --- 2. کالیبراسیون مقیاس (Reference Scale Calibration) ---

            if (mode === 'auto') {
                let circles = new cv.Mat();
                // پارامترهای HoughCircles برای تشخیص دقیق تر دایره مرجع تنظیم شده اند.
                cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1, gray.rows / 8, 100, 20, 10, 100);
                
                if (circles.cols === 0) {
                    self.postMessage({ error: "No robust reference circle found in Automatic mode. Try Manual mode." });
                    src.delete(); gray.delete(); displayMat.delete(); circles.delete();
                    return;
                }
                
                refCircle = { x: circles.data32F[0], y: circles.data32F[1], radius: circles.data32F[2] };
                pixelsPerMm = (refCircle.radius * 2) / refDiameter;
                // نمایش دایره مرجع
                cv.circle(displayMat, new cv.Point(refCircle.x, refCircle.y), refCircle.radius, new cv.Scalar(255, 0, 0, 255), 3);
                circles.delete();
            } else { // Manual mode
                if (!refPixelLength || refPixelLength === 0) {
                    self.postMessage({ error: "Invalid reference line drawn in Manual mode." });
                    src.delete(); gray.delete(); displayMat.delete();
                    return;
                }
                pixelsPerMm = refPixelLength / refDiameter;
                
                // ایجاد یک دایره مجازی برای فیلتر کردن ذراتی که روی مرجع قرار دارند.
                refCircle = {
                    x: (manualLine.start.x + manualLine.end.x) / 2,
                    y: (manualLine.start.y + manualLine.end.y) / 2,
                    radius: refPixelLength / 2
                };
                // نمایش خط مرجع
                cv.line(displayMat, new cv.Point(manualLine.start.x, manualLine.start.y), new cv.Point(manualLine.end.x, manualLine.end.y), new cv.Scalar(241, 196, 15, 255), 3);
            }

            // --- 3. بخش بندی (Segmentation) و تمیزکاری ---

            let binary = new cv.Mat();
            // آستانه گیری انطباقی
            cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 15, 2);
            
            // عملیات مورفولوژیکی: بسته شدن (Closing)
            // این عملیات سوراخ های کوچک داخل کانتورها را پر کرده و گسستگی های کوچک را حذف می کند.
            let kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
            cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel);
            kernel.delete();

            // --- 4. استخراج کانتور و فیلتر کردن ---

            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            let particles = [];

            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);

                // فیلتر بر اساس حداقل مساحت
                if (area > MIN_PARTICLE_AREA) {
                    let M = cv.moments(contour, false);
                    if (M.m00 === 0) { contour.delete(); continue; }
                    let cX = M.m10 / M.m00;
                    let cY = M.m01 / M.m00;
                    
                    // محاسبه محیط کانتور برای معیار گردی
                    const perimeter = cv.arcLength(contour, true);
                    const circularity = (perimeter === 0) ? 0 : (4 * Math.PI * area) / (perimeter * perimeter);
                    
                    // فیلتر بر اساس معیار گردی (MIN_CIRCULARITY)
                    if (circularity < MIN_CIRCULARITY) {
                        contour.delete();
                        continue;
                    }
                    
                    // فیلتر کردن دایره/خط مرجع
                    if (refCircle) {
                        const distToRef = Math.sqrt(Math.pow(cX - refCircle.x, 2) + Math.pow(cY - refCircle.y, 2));
                        if (distToRef < refCircle.radius) {
                            contour.delete();
                            continue;
                        }
                    }

                    // --- 5. اندازه گیری و ثبت نتایج ---
                    
                    // ترسیم کانتورهای نهایی (به رنگ سبز)
                    cv.drawContours(displayMat, contours, i, new cv.Scalar(0, 255, 0, 255), 2);
                    
                    const pixelArea = cv.contourArea(contour);
                    // محاسبه مساحت واقعی بر حسب میلی متر مربع
                    const areaInMm2 = pixelArea / (pixelsPerMm * pixelsPerMm); 
                    // محاسبه قطر معادل (قطر دایره ای با همین مساحت)
                    const equivalentDiameter = Math.sqrt(4 * areaInMm2 / Math.PI);
                    
                    particles.push({ 
                        diameter: equivalentDiameter, 
                        area: areaInMm2, 
                        circularity: circularity.toFixed(3) // اضافه کردن معیار گردی به خروجی
                    });
                }
                contour.delete();
            }

            // تبدیل ماتریکس نمایش نهایی به ImageData برای ارسال به Thread اصلی
            const finalImageData = new ImageData(new Uint8ClampedArray(displayMat.data), displayMat.cols, displayMat.rows);

            self.postMessage({ success: true, particles: particles, finalImageData: finalImageData });

            // حذف منابع OpenCV برای جلوگیری از نشت حافظه
            src.delete(); gray.delete(); displayMat.delete(); binary.delete(); contours.delete(); hierarchy.delete();

        } catch (error) {
            // ارسال پیام خطا در صورت شکست عملیات
            self.postMessage({ error: "OpenCV Error: " + error.message });
        }
    });
};
