class RecommendationTracker {
    constructor() {
        this.init();
    }

    init() {
        this.interceptPopups();
        setInterval(() => this.checkRecommendations(), 3600000); // كل ساعة
        this.checkRecommendations();
    }

    interceptPopups() {
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.crypto-card, .coin-card, [onclick]');
            if (card) {
                setTimeout(() => {
                    this.captureRecommendation();
                }, 500);
            }
        });
    }

    async captureRecommendation() {
        const popup = document.querySelector('.popup:not([style*="display: none"]), .modal:not([style*="display: none"])');
        if (!popup) return;

        const recommendationText = popup.textContent || popup.innerText;
        const recommendation = this.parseRecommendation(recommendationText, popup);
        
        if (recommendation) {
            const currentPrice = this.getCurrentPriceFromSite(recommendation.symbol);
            recommendation.entryPrice = currentPrice;
            recommendation.timestamp = Date.now();
            recommendation.status = 'active';
            
            this.saveRecommendation(recommendation);
            console.log('تم حفظ التوصية:', recommendation);
        }
    }

    parseRecommendation(text, popup) {
        try {
            // استخراج اسم العملة من عنوان النافذة
            const titleElement = popup.querySelector('h2, h3, .title, .popup-title');
            let symbol = '';
            
            if (titleElement) {
                const titleText = titleElement.textContent;
                const symbolMatch = titleText.match(/([A-Z]{2,10})/);
                if (symbolMatch) {
                    symbol = symbolMatch[1] + 'USDT';
                }
            }

            if (!symbol) {
                // محاولة استخراج من النص
                const symbolMatch = text.match(/([A-Z]{2,10}USDT?)/);
                if (symbolMatch) {
                    symbol = symbolMatch[1];
                }
            }

            if (!symbol) return null;

            // استخراج وقف الخسارة
            const stopLossMatch = text.match(/وقف الخسارة عند[:\s]*\$?([0-9.]+)/);
            const stopLoss = stopLossMatch ? parseFloat(stopLossMatch[1]) : null;

            // استخراج الأهداف
            const targets = [];
            const targetMatches = text.matchAll(/الهدف [الأول|الثاني|الثالث]+[:\s]*\$?([0-9.]+)/g);
            
            for (let match of targetMatches) {
                targets.push(parseFloat(match[1]));
            }

            if (targets.length === 0) return null;

            return {
                symbol: symbol,
                stopLoss: stopLoss,
                targets: targets,
                originalText: text.substring(0, 200)
            };

        } catch (error) {
            console.error('خطأ في تحليل التوصية:', error);
            return null;
        }
    }

    getCurrentPriceFromSite(symbol) {
        // البحث في البطاقات
        const cards = document.querySelectorAll('.crypto-card, .coin-card, .card, [class*="card"]');
        
        for (let card of cards) {
            const cardText = card.textContent || card.innerText;
            const coinName = symbol.replace('USDT', '');
            
            if (cardText.includes(symbol) || cardText.includes(coinName)) {
                // البحث عن السعر في البطاقة
                const priceMatches = cardText.match(/\$([0-9]+\.?[0-9]*)/g);
                if (priceMatches && priceMatches.length > 0) {
                    // أخذ آخر سعر (عادة يكون السعر الحالي)
                    const lastPrice = priceMatches[priceMatches.length - 1];
                    return parseFloat(lastPrice.replace('$', ''));
                }
            }
        }

        // إذا لم نجد في البطاقات، نبحث في كامل الصفحة
        const allText = document.body.textContent;
        const coinName = symbol.replace('USDT', '');
        const coinIndex = allText.indexOf(coinName);
        
        if (coinIndex !== -1) {
            const textAfterCoin = allText.substring(coinIndex, coinIndex + 200);
            const priceMatch = textAfterCoin.match(/\$([0-9]+\.?[0-9]*)/);
            if (priceMatch) {
                return parseFloat(priceMatch[1]);
            }
        }

        return null;
    }

    saveRecommendation(recommendation) {
        const recommendations = this.getStoredRecommendations();
        
        // تجنب التكرار
        const exists = recommendations.find(r => 
            r.symbol === recommendation.symbol && 
            Math.abs(r.timestamp - recommendation.timestamp) < 60000 // خلال دقيقة
        );
        
        if (!exists) {
            recommendations.push(recommendation);
            localStorage.setItem('crypto_recommendations', JSON.stringify(recommendations));
        }
    }

    getStoredRecommendations() {
        const stored = localStorage.getItem('crypto_recommendations');
        return stored ? JSON.parse(stored) : [];
    }

    async checkRecommendations() {
        const recommendations = this.getStoredRecommendations();
        const activeRecommendations = recommendations.filter(r => r.status === 'active');
        
        for (let rec of activeRecommendations) {
            const currentPrice = this.getCurrentPriceFromSite(rec.symbol);
            if (!currentPrice) continue;

            const result = this.analyzeRecommendation(rec, currentPrice);
            
            if (result.status !== 'active') {
                rec.status = result.status;
                rec.finalPrice = currentPrice;
                rec.profit = result.profit;
                rec.profitPercentage = result.profitPercentage;
                rec.completedAt = Date.now();
                rec.targetHit = result.targetHit;
            }

            rec.currentPrice = currentPrice;
        }

        localStorage.setItem('crypto_recommendations', JSON.stringify(recommendations));
    }

    analyzeRecommendation(rec, currentPrice) {
        const now = Date.now();
        const hoursPassed = (now - rec.timestamp) / (1000 * 60 * 60);

        // فحص وقف الخسارة
        if (rec.stopLoss && currentPrice <= rec.stopLoss) {
            const profit = currentPrice - rec.entryPrice;
            return {
                status: 'failed',
                profit: profit,
                profitPercentage: (profit / rec.entryPrice) * 100,
                targetHit: 0
            };
        }

        // فحص الأهداف
        for (let i = 0; i < rec.targets.length; i++) {
            if (currentPrice >= rec.targets[i]) {
                const profit = currentPrice - rec.entryPrice;
                return {
                    status: 'success',
                    profit: profit,
                    profitPercentage: (profit / rec.entryPrice) * 100,
                    targetHit: i + 1
                };
            }
        }

        // فحص انتهاء المدة (24 ساعة)
        if (hoursPassed >= 24) {
            const profit = currentPrice - rec.entryPrice;
            return {
                status: 'expired',
                profit: profit,
                profitPercentage: (profit / rec.entryPrice) * 100,
                targetHit: 0
            };
        }

        return { status: 'active' };
    }
}

// تشغيل المتتبع
const tracker = new RecommendationTracker();
