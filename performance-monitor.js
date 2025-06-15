// Performance Monitor - مراقب الأداء
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            loadTime: 0,
            renderTime: 0,
            memoryUsage: 0,
            signalProcessingTime: 0,
            apiResponseTime: 0
        };
        this.observers = [];
        this.init();
    }

    init() {
        this.measurePageLoad();
        this.setupPerformanceObserver();
        this.monitorMemoryUsage();
        this.trackUserInteractions();
        console.log('📊 Performance Monitor initialized');
    }

    measurePageLoad() {
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            this.metrics.loadTime = navigation.loadEventEnd - navigation.loadEventStart;
            
            console.log(`⚡ Page loaded in ${this.metrics.loadTime.toFixed(2)}ms`);
            
            // إرسال البيانات للتحليل (اختياري)
            this.reportMetrics('page_load', this.metrics.loadTime);
        });
    }

    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            // مراقبة أداء الرسم
            const paintObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.name === 'first-contentful-paint') {
                        console.log(`🎨 First Contentful Paint: ${entry.startTime.toFixed(2)}ms`);
                    }
                    if (entry.name === 'largest-contentful-paint') {
                        console.log(`🖼️ Largest Contentful Paint: ${entry.startTime.toFixed(2)}ms`);
                    }
                });
            });
            paintObserver.observe({entryTypes: ['paint', 'largest-contentful-paint']});

            // مراقبة تأخير الإدخال
            const inputObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    console.log(`⌨️ Input delay: ${entry.processingStart - entry.startTime}ms`);
                });
            });
            inputObserver.observe({entryTypes: ['first-input']});

            this.observers.push(paintObserver, inputObserver);
        }
    }

    monitorMemoryUsage() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
                
                // تحذير إذا تجاوز استخدام الذاكرة 100MB
                if (this.metrics.memoryUsage > 100) {
                    console.warn(`⚠️ High memory usage: ${this.metrics.memoryUsage.toFixed(2)}MB`);
                    this.optimizeMemory();
                }
            }, 30000); // كل 30 ثانية
        }
    }

    trackUserInteractions() {
        let interactionCount = 0;
        const interactions = ['click', 'scroll', 'keydown', 'touchstart'];
        
        interactions.forEach(event => {
            document.addEventListener(event, () => {
                interactionCount++;
            }, { passive: true });
        });

        // تقرير التفاعلات كل دقيقة
        setInterval(() => {
            if (interactionCount > 0) {
                console.log(`👆 User interactions in last minute: ${interactionCount}`);
                interactionCount = 0;
            }
        }, 60000);
    }

    measureSignalProcessing(startTime, signalCount) {
        const processingTime = performance.now() - startTime;
        this.metrics.signalProcessingTime = processingTime;
        
        console.log(`🔄 Processed ${signalCount} signals in ${processingTime.toFixed(2)}ms`);
        
        // تحذير إذا كان المعالجة بطيئة
        if (processingTime > 1000) {
            console.warn('⚠️ Slow signal processing detected');
        }
        
        return processingTime;
    }

    measureApiResponse(url, startTime) {
        const responseTime = performance.now() - startTime;
        this.metrics.apiResponseTime = responseTime;
        
        console.log(`🌐 API response from ${url}: ${responseTime.toFixed(2)}ms`);
        
        return responseTime;
    }

     optimizeMemory() {
        // تنظيف الذاكرة
        console.log('🧹 Starting memory optimization...');
        
        // إزالة event listeners غير المستخدمة
        this.cleanupEventListeners();
        
        // تنظيف DOM elements المؤقتة
        this.cleanupTempElements();
        
        // تشغيل garbage collection إذا كان متاحاً
        if (window.gc) {
            window.gc();
        }
        
        // إعادة قياس الذاكرة
        setTimeout(() => {
            if ('memory' in performance) {
                const newMemoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024;
                const saved = this.metrics.memoryUsage - newMemoryUsage;
                console.log(`✅ Memory optimized. Saved: ${saved.toFixed(2)}MB`);
            }
        }, 1000);
    }

    cleanupEventListeners() {
        // إزالة tooltips منتهية الصلاحية
        document.querySelectorAll('.custom-tooltip').forEach(tooltip => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });
        
        // إزالة notifications قديمة
        document.querySelectorAll('.notification').forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    cleanupTempElements() {
        // إزالة عناصر مؤقتة
        const tempElements = document.querySelectorAll('[data-temp="true"]');
        tempElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
    }

    reportMetrics(eventName, value) {
        // إرسال البيانات لخدمة التحليل (مثل Google Analytics)
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, {
                'custom_parameter': value
            });
        }
        
        // أو إرسال لخدمة مخصصة
        // this.sendToAnalytics(eventName, value);
    }

    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            metrics: { ...this.metrics },
            browser: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            },
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };

        console.log('📋 Performance Report:', report);
        return report;
    }

    // مراقبة أداء الشبكة
    monitorNetworkPerformance() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            const logConnectionInfo = () => {
                console.log(`📶 Network: ${connection.effectiveType}, ` +
                           `Downlink: ${connection.downlink}Mbps, ` +
                           `RTT: ${connection.rtt}ms`);
            };

            logConnectionInfo();
            connection.addEventListener('change', logConnectionInfo);
        }
    }

    // تتبع الأخطاء
    trackErrors() {
        window.addEventListener('error', (event) => {
            const errorInfo = {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                timestamp: new Date().toISOString()
            };
            
            console.error('❌ JavaScript Error:', errorInfo);
            this.reportMetrics('javascript_error', errorInfo);
        });

        window.addEventListener('unhandledrejection', (event) => {
            const errorInfo = {
                reason: event.reason,
                timestamp: new Date().toISOString()
            };
            
            console.error('❌ Unhandled Promise Rejection:', errorInfo);
            this.reportMetrics('promise_rejection', errorInfo);
        });
    }

    // مراقبة استخدام الموارد
    monitorResourceUsage() {
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (entry.transferSize > 1024 * 1024) { // أكبر من 1MB
                    console.warn(`📦 Large resource loaded: ${entry.name} (${(entry.transferSize / 1024 / 1024).toFixed(2)}MB)`);
                }
                
                if (entry.duration > 1000) { // أبطأ من ثانية واحدة
                    console.warn(`⏱️ Slow resource: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
                }
            });
        });
        
        observer.observe({entryTypes: ['resource']});
        this.observers.push(observer);
    }

    // تحسين الأداء التلقائي
    autoOptimize() {
        // تقليل جودة الرسوم المتحركة على الأجهزة البطيئة
        const slowDevice = this.metrics.loadTime > 3000 || this.metrics.memoryUsage > 150;
        
        if (slowDevice) {
            document.documentElement.style.setProperty('--animation-duration', '0.1s');
            console.log('🐌 Slow device detected, reducing animations');
        }

        // تأجيل تحميل المحتوى غير الضروري
        if (this.metrics.loadTime > 2000) {
            this.deferNonCriticalContent();
        }
    }

    deferNonCriticalContent() {
        // تأجيل تحميل الصور
        const images = document.querySelectorAll('img:not([data-critical])');
        images.forEach(img => {
            if (img.src) {
                img.dataset.src = img.src;
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+';
            }
        });

        // تأجيل تشغيل الرسوم المتحركة
        const animations = document.querySelectorAll('[data-animation]');
        animations.forEach(element => {
            element.style.animationPlayState = 'paused';
        });
    }

    // إنشاء تقرير مفصل
    createDetailedReport() {
        const report = this.generatePerformanceReport();
        
        // إضافة معلومات إضافية
        report.domStats = {
            totalElements: document.querySelectorAll('*').length,
            totalScripts: document.querySelectorAll('script').length,
            totalStyles: document.querySelectorAll('style, link[rel="stylesheet"]').length
        };

        // معلومات التخزين المحلي
        report.storage = {
            localStorage: this.getStorageSize('localStorage'),
            sessionStorage: this.getStorageSize('sessionStorage')
        };

        return report;
    }

    getStorageSize(storageType) {
        let total = 0;
        const storage = window[storageType];
        
        for (let key in storage) {
            if (storage.hasOwnProperty(key)) {
                total += storage[key].length + key.length;
            }
        }
        
        return total;
    }

    // تنظيف الموارد
    cleanup() {
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers = [];
        
        console.log('📊 Performance Monitor cleaned up');
    }
}

// إنشاء مثيل من مراقب الأداء
const performanceMonitor = new PerformanceMonitor();

// تصدير للاستخدام العام
window.performanceMonitor = performanceMonitor;

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    performanceMonitor.cleanup();
});

