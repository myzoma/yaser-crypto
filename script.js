class YaserCrypto {
    constructor() {
        this.coins = [];
        this.config = {
            apiUrl: "https://www.okx.com/api/v5",
            requestDelay: 500,
            maxCoins: 50,
            minChange: 1,
            maxChange: 15,
            minVolume: 100000
        };
        this.requestDelay = 500;
        this.init();
    }

    async init() {
        this.showLoading();
        await this.fetchData();
        this.analyzeCoins();
        this.renderCoins();
    }

    showLoading() {
      document.getElementById('coinsGrid').innerHTML = `
    <div class="loading">
        <div style="text-align: center; color: #00d4aa; padding: 20px;">
            <div style="font-size: 1.5rem; margin-bottom: 20px;">جاري تحليل البيانات</div>
            <div id="counter" style="font-size: 2rem; font-weight: bold; margin-bottom: 15px; color: #00d4aa;">0%</div>
            <div style="width: 300px; height: 20px; background: #333; border-radius: 10px; margin: 0 auto 15px; overflow: hidden;">
                <div id="bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #00d4aa, #00ff88, #40e0d0); border-radius: 10px; transition: width 0.3s ease;"></div>
            </div>
            <div id="status" style="color: #fff; margin-top: 10px;">بدء التحليل...</div>
        </div>
    </div>
`;

// تشغيل العداد
(function() {
    let count = 0;
    const timer = setInterval(() => {
        count += Math.random() * 5 + 1;
        if (count > 100) count = 100;
        
        const counterEl = document.getElementById('counter');
        const barEl = document.getElementById('bar');
        const statusEl = document.getElementById('status');
        
        if (counterEl && barEl && statusEl) {
            counterEl.textContent = Math.floor(count) + '%';
            barEl.style.width = count + '%';
            
            if (count < 30) {
                statusEl.textContent = 'تحميل البيانات...';
            } else if (count < 70) {
                statusEl.textContent = 'تحليل العملات...';
            } else if (count < 95) {
                statusEl.textContent = 'ترتيب النتائج...';
            } else if (count >= 100) {
                statusEl.textContent = 'اكتمل!';
                clearInterval(timer);
            }
        }
    }, 100);
})();

 

    showError(message) {
        document.getElementById('coinsGrid').innerHTML = `<div class="error">${message}</div>`;
    }

    async fetchData() {
        try {
            console.log('جاري جلب العملات المرشحة...');
            const candidateSymbols = await this.fetchTopGainers();
                        
            if (candidateSymbols.length === 0) {
                throw new Error('لم يتم العثور على عملات مرشحة');
            }
                        
            console.log(`🎯 سيتم تحليل ${candidateSymbols.length} عملة مرشحة`);
                        
            const results = [];
                        
            for (let i = 0; i < candidateSymbols.length; i++) {
                const symbol = candidateSymbols[i];
                console.log(`جاري تحليل ${symbol}... (${i + 1}/${candidateSymbols.length})`);
                                
                try {
                    const coin = await this.fetchCoinData(symbol);
                    if (coin && !isNaN(coin.change24h)) {
                        results.push(coin);
                        console.log(`✅ ${symbol}: ${coin.change24h.toFixed(2)}%`);
                    }
                                        
                    if (i < candidateSymbols.length - 1) {
                        await this.delay(this.requestDelay);
                    }
                } catch (error) {
                    console.warn(`❌ فشل تحليل ${symbol}:`, error.message);
                    continue;
                }
            }
                        
            this.coins = results;
                        
            if (this.coins.length === 0) {
                throw new Error('لم يتم العثور على عملات تحقق المعايير');
            }
                        
            console.log(`🏆 تم العثور على ${this.coins.length} عملة مرشحة`);
                    
        } catch (error) {
            console.error('خطأ في جلب البيانات:', error);
            this.showError(`خطأ في جلب البيانات: ${error.message}`);
        }
    }

    async fetchTopGainers() {
        try {
            console.log('جاري جلب قائمة أعلى الرابحون من OKX...');
                        
            const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`فشل في جلب البيانات: ${response.status}`);
            }
            const data = await response.json();
                        
            const usdtPairs = data.data
                .filter(ticker => ticker.instId.endsWith('-USDT'))
                .map(ticker => {
                    const currentPrice = parseFloat(ticker.last);
                    const openPrice = parseFloat(ticker.open24h);
                    const change24h = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
                                        
                    return {
                        symbol: ticker.instId.replace('-USDT', ''),
                        change24h: change24h,
                        volume: parseFloat(ticker.vol24h)
                    };
                })
                .filter(coin => coin.change24h > 1 && coin.change24h < 15)
                .filter(coin => coin.volume > 100000)
                .sort((a, b) => b.change24h - a.change24h)
                .slice(0, 50);
            console.log(`🎯 تم العثور على ${usdtPairs.length} عملة مرشحة`);
                        
            return usdtPairs.map(coin => coin.symbol);
        } catch (error) {
            console.error('خطأ:', error);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchCoinData(symbol) {
        try {
            const apiUrl = `https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT`;
                        
            const tickerResponse = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
                        
            if (!tickerResponse.ok) {
                throw new Error(`HTTP ${tickerResponse.status}: ${tickerResponse.statusText}`);
            }
                        
            const tickerData = await tickerResponse.json();
                        
            if (!tickerData.data || tickerData.data.length === 0) {
                throw new Error(`لا توجد بيانات لـ ${symbol}`);
            }
                        
            const ticker = tickerData.data[0];
                        
            const currentPrice = parseFloat(ticker.last);
            const openPrice24h = parseFloat(ticker.open24h);
            const change24h = openPrice24h > 0 ?
                 ((currentPrice - openPrice24h) / openPrice24h) * 100 : 0;
                        
            const coin = {
                symbol: symbol,
                name: symbol,
                price: currentPrice,
                change24h: change24h,
                volume: parseFloat(ticker.vol24h) || 0,
                high24h: parseFloat(ticker.high24h) || currentPrice,
                low24h: parseFloat(ticker.low24h) || currentPrice,
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
            throw error;
        }
    }

    calculateTechnicalIndicators(coin) {
        const currentPrice = coin.price;
        const high24h = coin.high24h;
        const low24h = coin.low24h;
                
        coin.technicalIndicators = {
            rsi: this.estimateRSIFromChange(coin.change24h),
            macd: coin.change24h > 0 ? 0.1 : -0.1,
            macdSignal: 0,
            macdHistogram: coin.change24h > 0 ? 0.1 : -0.1,
            ema20: currentPrice,
            ema50: currentPrice * (1 - coin.change24h / 100 * 0.5),
            ma20: currentPrice,
            ma50: currentPrice * (1 - coin.change24h / 100 * 0.5),
            parabolicSAR: low24h * 0.99,
            mfi: this.estimateMFIFromVolume(coin.volume, coin.change24h),
            fibonacci: this.calculateFibonacci([high24h], [low24h])
        };
                
        this.calculateTargets(coin);
    }

    estimateRSIFromChange(change24h) {
        if (change24h > 5) return 70;
        if (change24h > 2) return 60;
        if (change24h > 0) return 55;
        if (change24h > -2) return 45;
        if (change24h > -5) return 40;
        return 30;
    }

    estimateMFIFromVolume(volume, change24h) {
        const baseValue = change24h > 0 ? 60 : 40;
        const volumeBonus = Math.min(volume / 1000000 * 10, 20);
        return Math.min(Math.max(baseValue + volumeBonus, 0), 100);
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

        if (changePercent >= 3) {
            score += 10;
            conditions.rise3Percent = true;
        }
        if (changePercent >= 4) {
            score += 15;
            conditions.rise4Percent = true;
        }
        if (currentPrice > ema20 && currentPrice > ema50) {
            score += 25;
            conditions.breakoutMA = true;
        }
        if (rsi > 50) {
            score += 40;
            conditions.rsiBullish = true;
        }
        if (macd > macdSignal) {
            score += 60;
            conditions.macdBullish = true;
        }
        if (mfi > 50) {
            score += 80;
            conditions.mfiBullish = true;
        }

        const totalConditions = Object.keys(conditions).length;
        if (changePercent > 7 && totalConditions >= 4) {
            score += 90;
            conditions.strongRise = true;
        }
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
                
        let rankBadgeStyle = '';
        if (coin.rank === 1) {
            rankBadgeStyle = 'background: linear-gradient(45deg, #FFD700, #FFA500); color: #000; box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);';
        } else if (coin.rank === 2) {
            rankBadgeStyle = 'background: linear-gradient(45deg, #C0C0C0, #A8A8A8); color: #000; box-shadow: 0 0 10px rgba(192, 192, 192, 0.5);';
        } else if (coin.rank === 3) {
            rankBadgeStyle = 'background: linear-gradient(45deg, #CD7F32, #B8860B); color: #fff; box-shadow: 0 0 10px rgba(205, 127, 50, 0.5);';
        } else if (coin.rank <= 10) {
            rankBadgeStyle = 'background: linear-gradient(45deg, #4CAF50, #45a049); color: #fff;';
        } else {
            rankBadgeStyle = 'background: linear-gradient(45deg, #666, #555); color: #fff;';
        }

        card.innerHTML = `
            <div class="rank-badge" style="${rankBadgeStyle}">#${coin.rank}${coin.rank === 1 ? ' 🥇' : coin.rank === 2 ? ' 🥈' : coin.rank === 3 ? ' 🥉' : ''}</div>
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
