class YaserCrypto {
    constructor() {
        this.coins = [];
        this.config = null;
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const response = await fetch('config.json');
            this.config = await response.json();
            this.init();
        } catch (error) {
            console.error('خطأ في تحميل الإعدادات:', error);
            this.showError('خطأ في تحميل الإعدادات');
        }
    }

    async init() {
        this.showLoading();
        await this.fetchData();
        this.analyzeCoins();
        this.renderCoins();
    }

    showLoading() {
        document.getElementById('coinsGrid').innerHTML = '<div class="loading">جاري تحميل البيانات...</div>';
    }

    showError(message) {
        document.getElementById('coinsGrid').innerHTML = `<div class="error">${message}</div>`;
    }

    async fetchData() {
        try {
            const symbols = this.config.symbols;
            const promises = symbols.map(symbol => this.fetchCoinData(symbol));
            const results = await Promise.all(promises);
            this.coins = results.filter(coin => coin !== null);
        } catch (error) {
            console.error('خطأ في جلب البيانات:', error);
            this.showError('خطأ في جلب البيانات من المنصة');
        }
    }

    async fetchCoinData(symbol) {
        try {
            const tickerResponse = await fetch(`${this.config.apiBaseUrl}/api/v5/market/ticker?instId=${symbol}-USDT`, {
                headers: {
                    'OK-ACCESS-KEY': this.config.apiKey,
                    'OK-ACCESS-SIGN': '',
                    'OK-ACCESS-TIMESTAMP': Date.now().toString(),
                    'OK-ACCESS-PASSPHRASE': this.config.passphrase
                }
            });
            
            if (!tickerResponse.ok) {
                throw new Error(`HTTP error! status: ${tickerResponse.status}`);
            }
            
            const tickerData = await tickerResponse.json();
            
            if (!tickerData.data || tickerData.data.length === 0) {
                return null;
            }

            const ticker = tickerData.data[0];
            
            const candlesResponse = await fetch(`${this.config.apiBaseUrl}/api/v5/market/candles?instId=${symbol}-USDT&bar=1H&limit=100`);
            const candlesData = await candlesResponse.json();

            const coin = {
                symbol: symbol,
                name: symbol,
                price: parseFloat(ticker.last),
                change24h: parseFloat(ticker.sodUtc8),
                volume: parseFloat(ticker.vol24h),
                high24h: parseFloat(ticker.high24h),
                low24h: parseFloat(ticker.low24h),
                candles: candlesData.data || [],
                technicalIndicators: {},
                score: 0,
                rank: 0,
                conditions: {},
                targets: {}
            };

            this.calculateTechnicalIndicators(coin);
            
            return coin;
        } catch (error) {
            console.error(`خطأ في جلب بيانات ${symbol}:`, error);
            return null;
        }
    }

    calculateTechnicalIndicators(coin) {
        const candles = coin.candles;
        if (!candles || candles.length < 50) return;

        const closes = candles.map(c => parseFloat(c[4])).reverse();
        const highs = candles.map(c => parseFloat(c[2])).reverse();
        const lows = candles.map(c => parseFloat(c[3])).reverse();
        const volumes = candles.map(c => parseFloat(c[5])).reverse();

        // حساب RSI
        coin.technicalIndicators.rsi = this.calculateRSI(closes, 14);
        
        // حساب MACD
        const macdData = this.calculateMACD(closes);
        coin.technicalIndicators.macd = macdData.macd;
        coin.technicalIndicators.macdSignal = macdData.signal;
        coin.technicalIndicators.macdHistogram = macdData.histogram;
        
        // حساب المتوسطات المتحركة
        coin.technicalIndicators.ema20 = this.calculateEMA(closes, 20);
        coin.technicalIndicators.ema50 = this.calculateEMA(closes, 50);
        coin.technicalIndicators.ma20 = this.calculateSMA(closes, 20);
        coin.technicalIndicators.ma50 = this.calculateSMA(closes, 50);
        
        // حساب Parabolic SAR
        coin.technicalIndicators.parabolicSAR = this.calculateParabolicSAR(highs, lows, closes);
        
        // حساب MFI
        coin.technicalIndicators.mfi = this.calculateMFI(highs, lows, closes, volumes, 14);
        
        // حساب مستويات فيبوناتشي
        coin.technicalIndicators.fibonacci = this.calculateFibonacci(highs, lows);
        
        // تحديد الأهداف
        this.calculateTargets(coin);
    }

    calculateRSI(closes, period) {
        if (closes.length < period + 1) return 50;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        for (let i = period + 1; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - change) / period;
            }
        }
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateMACD(closes) {
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const macd = ema12 - ema26;
        const signal = this.calculateEMA([macd], 9);
        const histogram = macd - signal;
        
        return { macd, signal, histogram };
    }

    calculateEMA(closes, period) {
        if (closes.length < period) return closes[closes.length - 1];
        
        const multiplier = 2 / (period + 1);
        let ema = closes.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
        
        for (let i = period; i < closes.length; i++) {
            ema = (closes[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    calculateSMA(closes, period) {
        if (closes.length < period) return closes[closes.length - 1];
        
        const sum = closes.slice(-period).reduce((sum, price) => sum + price, 0);
        return sum / period;
    }

    calculateParabolicSAR(highs, lows, closes) {
        if (highs.length < 2) return closes[closes.length - 1];
        
        let sar = lows[0];
        let ep = highs[0];
        let af = 0.02;
        let trend = 1;
        
        for (let i = 1; i < highs.length; i++) {
            if (trend === 1) {
                sar = sar + af * (ep - sar);
                if (highs[i] > ep) {
                    ep = highs[i];
                    af = Math.min(af + 0.02, 0.2);
                }
                if (lows[i] < sar) {
                    trend = -1;
                    sar = ep;
                    ep = lows[i];
                    af = 0.02;
                }
            } else {
                sar = sar + af * (ep - sar);
                if (lows[i] < ep) {
                    ep = lows[i];
                    af = Math.min(af + 0.02, 0.2);
                }
                if (highs[i] > sar) {
                    trend = 1;
                    sar = ep;
                    ep = highs[i];
                    af = 0.02;
                }
            }
        }
        
        return sar;
    }

    calculateMFI(highs, lows, closes, volumes, period) {
        if (highs.length < period + 1) return 50;
        
        const typicalPrices = [];
        const moneyFlows = [];
        
        for (let i = 0; i < highs.length; i++) {
            const tp = (highs[i] + lows[i] + closes[i]) / 3;
            typicalPrices.push(tp);
            moneyFlows.push(tp * volumes[i]);
        }
        
        let positiveFlow = 0;
        let negativeFlow = 0;
        
        for (let i = 1; i <= period; i++) {
            if (typicalPrices[i] > typicalPrices[i - 1]) {
                positiveFlow += moneyFlows[i];
            } else {
                negativeFlow += moneyFlows[i];
            }
        }
        
        const mfr = positiveFlow / negativeFlow;
        return 100 - (100 / (1 + mfr));
    }

    calculateFibonacci(highs, lows) {
        const high = Math.max(...highs);
        const low = Math.min(...lows);
        const diff = high - low;
        
        return {
            level0: high,
            level236: high - (diff * 0.236),
            level382: high - (diff * 0.382),
            level500: high - (diff * 0.500),
            level618: high - (diff * 0.618),
            level786: high - (diff * 0.786),
            level100: low
        };
    }

    calculateTargets(coin) {
        const fib = coin.technicalIndicators.fibonacci;
        const currentPrice = coin.price;
        
        coin.targets = {
            entry: this.findNearestSupport(currentPrice, fib),
            stopLoss: fib.level786 * 0.98,
            target1: fib.level618,
            target2: fib.level382,
            target3: fib.level236,
            target4: fib.level0
        };
    }

    findNearestSupport(price, fib) {
        const levels = [fib.level618, fib.level500, fib.level382, fib.level236];
        let nearest = levels[0];
        let minDiff = Math.abs(price - nearest);
        
        for (const level of levels) {
            const diff = Math.abs(price - level);
            if (diff < minDiff && level < price) {
                nearest = level;
                minDiff = diff;
            }
        }
        
        return nearest;
    }

    analyzeCoins() {
        this.coins.forEach(coin => {
            this.calculateScore(coin);
        });
        
        this.coins.sort((a, b) => b.score - a.score);
        
        this.coins.forEach((coin, index) => {
            coin.rank = index + 1;
        });
    }

    calculateScore(coin) {
        let score = 0;
        const conditions = {};
        const changePercent = coin.change24h;
        const rsi = coin.technicalIndicators.rsi;
        const macd = coin.technicalIndicators.macd;
        const macdSignal = coin.technicalIndicators.macdSignal;
        const mfi = coin.technicalIndicators.mfi;
        const currentPrice = coin.price;
        const ema20 = coin.technicalIndicators.ema20;
        const ema50 = coin.technicalIndicators.ema50;

        // الشرط 1: ارتفاع 3%
        if (changePercent >= 3) {
            score += 10;
            conditions.rise3Percent = true;
        }

        // الشرط 2: ارتفاع 4%
        if (changePercent >= 4) {
            score += 15;
            conditions.rise4Percent = true;
        }

        // الشرط 3: اختراق المتوسطات
        if (currentPrice > ema20 && currentPrice > ema50) {
            score += 25;
            conditions.breakoutMA = true;
        }

        // الشرط 4: RSI اختراق مستوى 50
        if (rsi > 50) {
            score += 40;
            conditions.rsiBullish = true;
        }

        // الشرط 5: MACD تقاطع خط الإشارة
        if (macd > macdSignal) {
            score += 60;
            conditions.macdBullish = true;
        }

        // الشرط 6: مؤشر السيولة فوق 50
        if (mfi > 50) {
            score += 80;
            conditions.mfiBullish = true;
        }

        // الشرط 7: ارتفاع أكثر من 7% + 70% من الشروط
        const totalConditions = Object.keys(conditions).length;
        if (changePercent > 7 && totalConditions >= 4) {
            score += 90;
            conditions.strongRise = true;
        }

        // الشرط 8: جميع الشروط + ارتفاع أكثر من 9%
        if (changePercent > 9 && totalConditions >= 6) {
            score += 100;
            conditions.perfectScore = true;
        }

        coin.score = score;
        coin.conditions = conditions;
    }

    renderCoins() {
        const grid = document.getElementById('coinsGrid');
        grid.innerHTML = '';

        this.coins.forEach(coin => {
            const card = this.createCoinCard(coin);
            grid.appendChild(card);
        });
    }

       createCoinCard(coin) {
        const card = document.createElement('div');
        card.className = 'coin-card';
        card.onclick = () => this.showCoinDetails(coin);

        const changeClass = coin.change24h >= 0 ? 'positive' : 'negative';
        const changeSign = coin.change24h >= 0 ? '+' : '';
        const liquidityPercent = Math.min((coin.technicalIndicators.mfi || 0), 100);

        card.innerHTML = `
            <div class="rank-badge">#${coin.rank}</div>
            <div class="coin-header">
                <div class="coin-logo">${coin.symbol.charAt(0)}</div>
                <div class="coin-info">
                    <h3>${coin.name}</h3>
                    <div class="coin-price">
                        $${coin.price.toFixed(4)}
                        <span class="price-change ${changeClass}">
                            ${changeSign}${coin.change24h.toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>
            <div class="coin-metrics">
                <div class="metric-row">
                    <span class="metric-label">النقاط:</span>
                    <span class="metric-value">${coin.score}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">حجم التداول:</span>
                    <span class="metric-value">${this.formatVolume(coin.volume)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">RSI:</span>
                    <span class="metric-value">${(coin.technicalIndicators.rsi || 0).toFixed(1)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">MFI:</span>
                    <span class="metric-value">${(coin.technicalIndicators.mfi || 0).toFixed(1)}</span>
                </div>
            </div>
            <div class="score-bar">
                <div class="score-fill" style="width: ${Math.min(coin.score, 100)}%"></div>
            </div>
            <div style="margin-top: 5px; font-size: 0.8rem; color: #aaa;">شريط السيولة</div>
            <div class="liquidity-bar">
                <div class="liquidity-fill" style="width: ${liquidityPercent}%"></div>
            </div>
        `;

        return card;
    }

    formatVolume(volume) {
        if (volume >= 1000000) {
            return (volume / 1000000).toFixed(1) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(1) + 'K';
        }
        return volume.toFixed(0);
    }

    showCoinDetails(coin) {
        const modal = document.getElementById('coinModal');
        const modalBody = document.getElementById('modalBody');

        const fib = coin.technicalIndicators.fibonacci;
        const targets = coin.targets;

        modalBody.innerHTML = `
            <div class="modal-header">
                <div class="modal-coin-logo">${coin.symbol.charAt(0)}</div>
                <h2>${coin.name}</h2>
                <p>المركز: #${coin.rank} | النقاط: ${coin.score}</p>
                <p>السعر الحالي: $${coin.price.toFixed(4)}</p>
            </div>

            <div class="technical-indicators">
                <div class="indicator-card">
                    <div class="indicator-title">RSI (14)</div>
                    <div class="indicator-value">${(coin.technicalIndicators.rsi || 0).toFixed(2)}</div>
                    <div style="color: ${coin.technicalIndicators.rsi > 50 ? '#00ff88' : '#ff4757'}; font-size: 0.9rem;">
                        ${coin.technicalIndicators.rsi > 50 ? 'صاعد' : 'هابط'}
                    </div>
                </div>

                <div class="indicator-card">
                    <div class="indicator-title">MACD</div>
                    <div class="indicator-value">${(coin.technicalIndicators.macd || 0).toFixed(4)}</div>
                    <div style="color: ${coin.technicalIndicators.macd > coin.technicalIndicators.macdSignal ? '#00ff88' : '#ff4757'}; font-size: 0.9rem;">
                        ${coin.technicalIndicators.macd > coin.technicalIndicators.macdSignal ? 'تقاطع صاعد' : 'تقاطع هابط'}
                    </div>
                </div>

                <div class="indicator-card">
                    <div class="indicator-title">EMA 20</div>
                    <div class="indicator-value">$${(coin.technicalIndicators.ema20 || 0).toFixed(4)}</div>
                    <div style="color: ${coin.price > coin.technicalIndicators.ema20 ? '#00ff88' : '#ff4757'}; font-size: 0.9rem;">
                        ${coin.price > coin.technicalIndicators.ema20 ? 'فوق المتوسط' : 'تحت المتوسط'}
                    </div>
                </div>

                <div class="indicator-card">
                    <div class="indicator-title">EMA 50</div>
                    <div class="indicator-value">$${(coin.technicalIndicators.ema50 || 0).toFixed(4)}</div>
                    <div style="color: ${coin.price > coin.technicalIndicators.ema50 ? '#00ff88' : '#ff4757'}; font-size: 0.9rem;">
                        ${coin.price > coin.technicalIndicators.ema50 ? 'فوق المتوسط' : 'تحت المتوسط'}
                    </div>
                </div>

                <div class="indicator-card">
                    <div class="indicator-title">Parabolic SAR</div>
                    <div class="indicator-value">$${(coin.technicalIndicators.parabolicSAR || 0).toFixed(4)}</div>
                    <div style="color: ${coin.price > coin.technicalIndicators.parabolicSAR ? '#00ff88' : '#ff4757'}; font-size: 0.9rem;">
                        ${coin.price > coin.technicalIndicators.parabolicSAR ? 'اتجاه صاعد' : 'اتجاه هابط'}
                    </div>
                </div>

                <div class="indicator-card">
                    <div class="indicator-title">MFI (14)</div>
                    <div class="indicator-value">${(coin.technicalIndicators.mfi || 0).toFixed(2)}</div>
                    <div style="color: ${coin.technicalIndicators.mfi > 50 ? '#00ff88' : '#ff4757'}; font-size: 0.9rem;">
                        ${coin.technicalIndicators.mfi > 50 ? 'سيولة قوية' : 'سيولة ضعيفة'}
                    </div>
                </div>
            </div>

            <div class="targets-section">
                <h3 style="color: #00d4aa; margin-bottom: 15px;">الأهداف والمستويات</h3>
                <div class="targets-grid">
                    <div class="target-item">
                        <div class="target-label">نقطة الدخول</div>
                        <div class="target-value">$${targets.entry.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">وقف الخسارة</div>
                        <div class="target-value">$${targets.stopLoss.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">الهدف الأول</div>
                        <div class="target-value">$${targets.target1.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">الهدف الثاني</div>
                        <div class="target-value">$${targets.target2.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">الهدف الثالث</div>
                        <div class="target-value">$${targets.target3.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">الهدف الرابع</div>
                        <div class="target-value">$${targets.target4.toFixed(4)}</div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
                <h3 style="color: #00d4aa; margin-bottom: 15px;">مستويات فيبوناتشي</h3>
                <div class="targets-grid">
                    <div class="target-item">
                        <div class="target-label">0% (القمة)</div>
                        <div class="target-value">$${fib.level0.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">23.6%</div>
                        <div class="target-value">$${fib.level236.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">38.2%</div>
                        <div class="target-value">$${fib.level382.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">50%</div>
                        <div class="target-value">$${fib.level500.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">61.8%</div>
                        <div class="target-value">$${fib.level618.toFixed(4)}</div>
                    </div>
                    <div class="target-item">
                        <div class="target-label">78.6%</div>
                        <div class="target-value">$${fib.level786.toFixed(4)}</div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
                <h3 style="color: #00d4aa; margin-bottom: 15px;">الشروط المحققة</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px;">
                    ${this.renderConditions(coin.conditions)}
                </div>
            </div>
        `;

        modal.style.display = 'block';
    }

    renderConditions(conditions) {
        const conditionLabels = {
            rise3Percent: 'ارتفاع 3% - 10 نقاط',
            rise4Percent: 'ارتفاع 4% - 15 نقطة',
            breakoutMA: 'اختراق المتوسطات - 25 نقطة',
            rsiBullish: 'RSI فوق 50 - 40 نقطة',
            macdBullish: 'MACD تقاطع صاعد - 60 نقطة',
            mfiBullish: 'MFI فوق 50 - 80 نقطة',
            strongRise: 'ارتفاع قوي +7% - 90 نقطة',
            perfectScore: 'جميع الشروط +9% - 100 نقطة'
        };

        let html = '';
        for (const [key, label] of Object.entries(conditionLabels)) {
            const achieved = conditions[key] || false;
            html += `
                <div style="padding: 10px; background: ${achieved ? '#1a4d3a' : '#4d1a1a'}; border-radius: 8px; border: 1px solid ${achieved ? '#00ff88' : '#ff4757'};">
                    <div style="color: ${achieved ? '#00ff88' : '#ff4757'}; font-size: 0.9rem;">
                        ${achieved ? '✓' : '✗'} ${label}
                    </div>
                </div>
            `;
        }
        return html;
    }
}

// الدوال العامة
function closeModal() {
    document.getElementById('coinModal').style.display = 'none';
}

function refreshData() {
    if (window.yaserCrypto) {
        window.yaserCrypto.init();
    }
}

// إغلاق النافذة المنبثقة عند النقر خارجها
window.onclick = function(event) {
    const modal = document.getElementById('coinModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// تشغيل التطبيق
document.addEventListener('DOMContentLoaded', function() {
    window.yaserCrypto = new YaserCrypto();
});
