// UI Controller - التحكم في واجهة المستخدم
class UIController {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'dark';
        this.init();
    }

    init() {
        this.setupTheme();
        this.setupResponsiveHandlers();
        this.setupKeyboardShortcuts();
        this.setupScrollEffects();
        this.setupTooltips();
        console.log('🎨 UI Controller initialized');
    }

    setupTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // إنشاء زر تبديل الثيم
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.innerHTML = this.theme === 'dark' ? '🌙' : '☀️';
        themeToggle.title = 'تبديل الثيم';
        themeToggle.addEventListener('click', () => this.toggleTheme());
        
        document.body.appendChild(themeToggle);
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        
        const themeToggle = document.querySelector('.theme-toggle');
        themeToggle.innerHTML = this.theme === 'dark' ? '🌙' : '☀️';
        
        // تأثير انتقالي
        document.body.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    }

    setupResponsiveHandlers() {
        // معالجة تغيير حجم الشاشة
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });

        // معالجة تدوير الشاشة
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResize();
            }, 500);
        });
    }

    handleResize() {
        const width = window.innerWidth;
        
        // تحديث تخطيط الشبكة حسب حجم الشاشة
        const signalsGrid = document.querySelector('.signals-grid');
        if (signalsGrid) {
            if (width < 768) {
                signalsGrid.style.gridTemplateColumns = '1fr';
            } else if (width < 1200) {
                signalsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
            } else {
                signalsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(350px, 1fr))';
            }
        }

        // تحديث الهيدر للشاشات الصغيرة
        const headerContent = document.querySelector('.header-content');
        if (headerContent) {
            if (width < 768) {
                headerContent.style.flexDirection = 'column';
                headerContent.style.textAlign = 'center';
            } else {
                headerContent.style.flexDirection = 'row';
                headerContent.style.textAlign = 'right';
            }
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + R: تحديث البيانات
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                loadUTBotSignals();
            }
            
            // Ctrl/Cmd + E: تصدير البيانات
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                exportSignals();
            }
            
            // Ctrl/Cmd + I: معلومات النظام
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                showSystemInfo();
            }
            
            // مفاتيح الأرقام للفلترة
            if (e.key >= '1' && e.key <= '3') {
                const filters = ['all', 'buy', 'sell'];
                const filterIndex = parseInt(e.key) - 1;
                if (filters[filterIndex]) {
                    const tabBtn = document.querySelector(`[data-filter="${filters[filterIndex]}"]`);
                    if (tabBtn) tabBtn.click();
                }
            }
        });
    }

    setupScrollEffects() {
        // تأثير الشفافية للهيدر عند التمرير
        let lastScrollTop = 0;
        const header = document.querySelector('.main-header');
        
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // التمرير لأسفل
                header.style.transform = 'translateY(-100%)';
            } else {
                // التمرير لأعلى
                header.style.transform = 'translateY(0)';
            }
            
            // تأثير الشفافية
            const opacity = Math.max(0.9, 1 - scrollTop / 500);
            header.style.background = `rgba(18, 18, 18, ${opacity})`;
            
            lastScrollTop = scrollTop;
        });

        // تأثير الظهور التدريجي للعناصر
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        }, observerOptions);

        // مراقبة العناصر
        document.querySelectorAll('.control-panel, .signals-section').forEach(el => {
            observer.observe(el);
        });
    }

    setupTooltips() {
        // إضافة tooltips ديناميكية
        document.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('tooltip')) {
                this.showTooltip(e.target);
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.classList.contains('tooltip')) {
                this.hideTooltip(e.target);
            }
        });
    }

    showTooltip(element) {
        const tooltip = element.getAttribute('data-tooltip');
        if (!tooltip) return;

        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'custom-tooltip';
        tooltipEl.textContent = tooltip;
        tooltipEl.style.cssText = `
            position: absolute;
            background: var(--bg-darker);
            color: var(--text-light);
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 12px;
            border: 1px solid var(--primary-color);
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(tooltipEl);

        const rect = element.getBoundingClientRect();
        tooltipEl.style.left = rect.left + (rect.width / 2) - (tooltipEl.offsetWidth / 2) + 'px';
        tooltipEl.style.top = rect.top - tooltipEl.offsetHeight - 10 + 'px';

        setTimeout(() => {
            tooltipEl.style.opacity = '1';
        }, 10);

        element._tooltip = tooltipEl;
    }

    hideTooltip(element) {
        if (element._tooltip) {
            element._tooltip.style.opacity = '0';
            setTimeout(() => {
                if (element._tooltip && element._tooltip.parentNode) {
                    element._tooltip.parentNode.removeChild(element._tooltip);
                }
                element._tooltip = null;
            }, 300);
        }
    }

    // تحسين الأداء
    optimizePerformance() {
        // تأخير تحميل الصور
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));

        // تحسين الرسوم المتحركة
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (prefersReducedMotion.matches) {
            document.documentElement.style.setProperty('--animation-duration', '0.01ms');
        }
    }

    // إضافة تأثيرات بصرية
    addVisualEffects() {
        // تأثير الجسيمات في الخلفية
        this.createParticleEffect();
        
        // تأثير الوهج للأزرار
        this.addButtonGlowEffect();
    }

       createParticleEffect() {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: -1;
            opacity: 0.1;
        `;
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const particles = [];

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        function createParticle() {
            return {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2 + 1,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
                opacity: Math.random() * 0.5 + 0.2
            };
        }

        function initParticles() {
            particles.length = 0;
            for (let i = 0; i < 50; i++) {
                particles.push(createParticle());
            }
        }

        function updateParticles() {
            particles.forEach(particle => {
                particle.x += particle.speedX;
                particle.y += particle.speedY;

                if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
                if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;
            });
        }

        function drawParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(particle => {
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 204, 255, ${particle.opacity})`;
                ctx.fill();
            });

            // رسم الخطوط بين الجسيمات القريبة
            particles.forEach((particle1, i) => {
                particles.slice(i + 1).forEach(particle2 => {
                    const distance = Math.sqrt(
                        Math.pow(particle1.x - particle2.x, 2) + 
                        Math.pow(particle1.y - particle2.y, 2)
                    );

                    if (distance < 100) {
                        ctx.beginPath();
                        ctx.moveTo(particle1.x, particle1.y);
                        ctx.lineTo(particle2.x, particle2.y);
                        ctx.strokeStyle = `rgba(0, 204, 255, ${0.1 * (1 - distance / 100)})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                });
            });
        }

        function animate() {
            updateParticles();
            drawParticles();
            requestAnimationFrame(animate);
        }

        resizeCanvas();
        initParticles();
        animate();

        window.addEventListener('resize', () => {
            resizeCanvas();
            initParticles();
        });
    }

    addButtonGlowEffect() {
        const buttons = document.querySelectorAll('button, .tab-btn');
        
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.boxShadow = '0 0 20px rgba(0, 204, 255, 0.5)';
                button.style.transform = 'translateY(-2px)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.boxShadow = '';
                button.style.transform = '';
            });
        });
    }

    // إضافة مؤثرات صوتية (اختيارية)
    addSoundEffects() {
        // إنشاء أصوات بسيطة باستخدام Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        const playSound = (frequency, duration, type = 'sine') => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = type;

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        };

        // صوت عند تحديث الإشارات
        document.addEventListener('signalsUpdated', () => {
            playSound(800, 0.2);
        });

        // صوت عند النقر على الأزرار
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                playSound(600, 0.1);
            }
        });
    }

    // إدارة الحالة المحلية
    saveState() {
        const state = {
            theme: this.theme,
            lastUpdate: Date.now(),
            preferences: {
                soundEnabled: this.soundEnabled || false,
                particlesEnabled: this.particlesEnabled || true
            }
        };
        localStorage.setItem('utbot-state', JSON.stringify(state));
    }

    loadState() {
        const savedState = localStorage.getItem('utbot-state');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.theme = state.theme || 'dark';
            this.soundEnabled = state.preferences?.soundEnabled || false;
            this.particlesEnabled = state.preferences?.particlesEnabled || true;
        }
    }

    // تحسين إمكانية الوصول
    enhanceAccessibility() {
        // إضافة ARIA labels
        document.querySelectorAll('button').forEach(button => {
            if (!button.getAttribute('aria-label') && button.textContent) {
                button.setAttribute('aria-label', button.textContent.trim());
            }
        });

        // إضافة focus indicators
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });

        // تحسين التنقل بلوحة المفاتيح
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // إغلاق أي tooltips مفتوحة
                document.querySelectorAll('.custom-tooltip').forEach(tooltip => {
                    tooltip.remove();
                });
            }
        });
    }

    // معالجة الأخطاء البصرية
    handleVisualErrors() {
        // إضافة مؤشر للأخطاء
        const errorIndicator = document.createElement('div');
        errorIndicator.id = 'error-indicator';
        errorIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--danger-color);
            display: none;
            z-index: 1001;
            animation: pulse 1s infinite;
        `;
        document.body.appendChild(errorIndicator);

        // مراقبة الأخطاء
        window.addEventListener('error', () => {
            errorIndicator.style.display = 'block';
            setTimeout(() => {
                errorIndicator.style.display = 'none';
            }, 5000);
        });
    }

    // تحديث الواجهة بناءً على حالة الشبكة
    handleNetworkStatus() {
        const updateNetworkStatus = () => {
            const isOnline = navigator.onLine;
            const statusIndicator = document.getElementById('networkStatus') || 
                                  document.createElement('div');
            
            if (!document.getElementById('networkStatus')) {
                statusIndicator.id = 'networkStatus';
                statusIndicator.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 80px;
                    padding: 8px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    z-index: 1000;
                    transition: all 0.3s ease;
                `;
                document.body.appendChild(statusIndicator);
            }

            if (isOnline) {
                statusIndicator.textContent = '🟢 متصل';
                statusIndicator.style.background = 'rgba(0, 200, 83, 0.2)';
                statusIndicator.style.color = 'var(--success-color)';
                statusIndicator.style.border = '1px solid var(--success-color)';
            } else {
                statusIndicator.textContent = '🔴 غير متصل';
                statusIndicator.style.background = 'rgba(255, 53, 71, 0.2)';
                statusIndicator.style.color = 'var(--danger-color)';
                statusIndicator.style.border = '1px solid var(--danger-color)';
            }
        };

        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus();
    }

    // تنظيف الموارد
    cleanup() {
        // إزالة event listeners
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleResize);
        
        // حفظ الحالة
        this.saveState();
        
        console.log('UI Controller cleaned up');
    }
}

// إنشاء مثيل من UI Controller
const uiController = new UIController();

// تصدير للاستخدام العام
window.uiController = uiController;

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    uiController.cleanup();
});
