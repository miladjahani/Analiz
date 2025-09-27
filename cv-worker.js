// cv-worker.js

// 1. Import OpenCV.js
self.importScripts('https://docs.opencv.org/4.9.0/opencv.js');

self.onmessage = function(e) {
    const { imageData, refDiameter } = e.data;

    // Wait for OpenCV to be ready
    const cvReady = new Promise((resolve) => {
        if (self.cv) {
            resolve();
        } else {
            self.onCvReady = () => {
                resolve();
            };
        }
    });

    cvReady.then(() => {
        try {
            const src = cv.matFromImageData(imageData);
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            cv.GaussianBlur(gray, gray, new cv.Size(7, 7), 1.5, 1.5);

            // --- Reference Object Detection ---
            let circles = new cv.Mat();
            cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1, gray.rows / 8, 100, 30, 10, 100);

            if (circles.cols === 0) {
                self.postMessage({ error: "No reference circle found." });
                return;
            }

            const refCircle = { x: circles.data32F[0], y: circles.data32F[1], radius: circles.data32F[2] };
            const pixelsPerMm = (refCircle.radius * 2) / refDiameter;

            // --- Particle Detection ---
            let binary = new cv.Mat();
            cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            let particles = [];
            const minParticleArea = 20;

            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);

                if (area > minParticleArea) {
                    let M = cv.moments(contour, false);
                    if (M.m00 === 0) continue;
                    let cX = M.m10 / M.m00;
                    let cY = M.m01 / M.m00;

                    const distToRef = Math.sqrt(Math.pow(cX - refCircle.x, 2) + Math.pow(cY - refCircle.y, 2));
                    if (distToRef < refCircle.radius) continue;

                    const pixelArea = cv.contourArea(contour);
                    const areaInMm2 = pixelArea / (pixelsPerMm * pixelsPerMm);
                    const equivalentDiameter = Math.sqrt(4 * areaInMm2 / Math.PI);

                    particles.push({ diameter: equivalentDiameter, area: areaInMm2 });
                }
                contour.delete();
            }

            // --- Post results back to the main thread ---
            self.postMessage({
                success: true,
                particles: particles,
                refCircle: refCircle // Send refCircle for drawing on the main thread
            });

            // Cleanup
            src.delete(); gray.delete(); circles.delete(); binary.delete(); contours.delete(); hierarchy.delete();

        } catch (error) {
            self.postMessage({ error: error.message });
        }
    });
};