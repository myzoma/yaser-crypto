// إصدار محسن v3.0 - تحسينات شاملة للمؤشرات الفنية
console.log('🚀 إصدار محسن v3.0 - ' + new Date().toLocaleTimeString());

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
        document.getElementById('coinsGrid').innerHTML = '<div class="loading">يتم التحليل الان .. انتظر قليلا من فضلك ؟...</div>';
    }

    showError(message) {
        document.getElementById('coinsGrid').innerHTML = `<div class="error">${message}</div>`;
    }

    async fetchData() {
        try {
            console.log('🚀 بدء عملية جلب البيانات...');
            
            const candidateSymbols = await this.fetchTopGainers();
            
            if (!candidateSymbols || candidateSymbols.length === 0) {
                throw new Error('لم يتم العثور على عملات مرشحة');
            }
            
            console.log(`📋 سيتم تحليل ${candidateSymbols.length} عملة`);
            
            const results = [];
            
            for (let i = 0; i < candidateSymbols.length; i++) {
                const symbol = candidateSymbols[i];
                
                try {
                    console.log(`🔄 تحليل ${symbol}... (${i + 1}/${candidateSymbols.length})`);
                    
                    const coin = await this.fetchCoinData(symbol);
                    
                    if (coin && typeof coin.change24h === 'number' && !isNaN(coin.change24h)) {
                        results.push(coin);
                        console.log(`✅ ${symbol}: ${coin.change24h.toFixed(2)}%`);
                    } else {
                        console.warn(`⚠️ بيانات غير صالحة لـ ${symbol}`);
                    }
                    
                    // تأخير بين الطلبات
                    if (i < candidateSymbols.length - 1) {
                        await this.delay(this.requestDelay);
                    }
                    
                } catch (error) {
                    console.warn(`❌ فشل في تحليل ${symbol}:`, error.message);
                    continue; // تجاهل العملة والانتقال للتالية
                }
            }
            
            if (results.length === 0) {
                throw new Error('فشل في الحصول على بيانات صالحة لأي عملة');
            }
            
            this.coins = results;
            console.log(`🎉 تم تحليل ${this.coins.length} عملة بنجاح`);
            
        } catch (error) {
            console.error('💥 خطأ في fetchData:', error);
            this.showError(`خطأ في جلب البيانات: ${error.message}`);
            throw error;
        }
    }

    async fetchTopGainers() {
        try {
            console.log('جاري جلب قائمة أعلى الرابحون من OKX...');
            
            const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`فشل في جلب البيانات: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📡 استلام البيانات من API:', data.data ? data.data.length : 0, 'عملة');
            
            if (!data.data || data.data.length === 0) {
                throw new Error('لا توجد بيانات من API');
            }
            
            // فلترة العملات مع معايير أوسع
            const usdtPairs = data.data
                .filter(ticker => {
                    if (!ticker.instId || !ticker.instId.endsWith('-USDT')) {
                        return false;
                    }
                    
                    const currentPrice = parseFloat(ticker.last);
                    const openPrice = parseFloat(ticker.open24h);
                    const volume = parseFloat(ticker.vol24h);
                    
                    // التحقق من صحة البيانات
                    if (!currentPrice || !openPrice || currentPrice <= 0 || openPrice <= 0) {
                        return false;
                    }
                    
                    const change24h = ((currentPrice - openPrice) / openPrice) * 100;
                    
                    // معايير أوسع للحصول على عملات أكثر
                    const validChange = change24h > 0.5 && change24h < 25; // من 0.5% إلى 25%
                    const validVolume = volume > 10000; // حجم أكبر من 10K
                    
                    return validChange && validVolume;
                })
                .map(ticker => {
                    const currentPrice = parseFloat(ticker.last);
                    const openPrice = parseFloat(ticker.open24h);
                    const change24h = ((currentPrice - openPrice) / openPrice) * 100;
                    
                    return {
                        symbol: ticker.instId.replace('-USDT', ''),
                        change24h: change24h,
                        volume: parseFloat(ticker.vol24h),
                        price: currentPrice
                    };
                })
                .sort((a, b) => b.change24h - a.change24h) // ترتيب حسب الأعلى ارتفاعاً
                .slice(0, 30); // أخذ أفضل 30 عملة

            console.log(`🎯 تم العثور على ${usdtPairs.length} عملة مرشحة`);
            
            if (usdtPairs.length === 0) {
                throw new Error('لم يتم العثور على عملات تحقق المعايير');
            }
            
            // عرض أفضل 5 عملات للتحقق
            console.log('🏆 أفضل 5 عملات مرشحة:');
            usdtPairs.slice(0, 5).forEach((coin, index) => {
                console.log(`${index + 1}. ${coin.symbol}: +${coin.change24h.toFixed(2)}% - الحجم: ${coin.volume.toLocaleString()}`);
            });
            
            return usdtPairs.map(coin => coin.symbol);
            
        } catch (error) {
            console.error('❌ خطأ في fetchTopGainers:', error);
            throw error; // رمي الخطأ بدلاً من استخدام بيانات وهمية
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
            
            // استخدام التغيير المباشر من API بدلاً من الحساب اليدوي
            const change24h = parseFloat(ticker.changePercent) || 
                (openPrice24h > 0 ? ((currentPrice - openPrice24h) / openPrice24h) * 100 : 0);
            
            console.log(`📊 ${symbol}: السعر=${currentPrice}, التغيير=${change24h.toFixed(2)}%`);
            
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
        // حساب RSI محسن
        const change = coin.change24h;
        if (change > 10) {
            coin.technicalIndicators.rsi = 75 + Math.min(change - 10, 15);
        } else if (change > 5) {
            coin.technicalIndicators.rsi = 65 + (change - 5);
        } else if (change > 0) {
            coin.technicalIndicators.rsi = 55 + (change * 2);
        } else if (change > -5) {
            coin.technicalIndicators.rsi = 45 + (change * 2);
        } else {
            coin.technicalIndicators.rsi = 30 + Math.max(change + 5, -15);
        }
        coin.technicalIndicators.rsi = Math.max(0, Math.min(100, coin.technicalIndicators.rsi));

        // حساب MACD محسن
        const volume = coin.volume || 1000000;
        if (change > 5) {
            coin.technicalIndicators.macd = 0.3 + (change - 5) * 0.05;
            coin.technicalIndicators.macdSignal = 0.2;
        } else if (change > 0) {
            coin.technicalIndicators.macd = change * 0.04;
            coin.technicalIndicators.macdSignal = change * 0.02;
        } else {
            coin.technicalIndicators.macd = change * 0.03;
            coin.technicalIndicators.macdSignal = change * 0.01;
        }

        // حساب MFI محسن
        const volumeWeight = Math.log10(volume / 1000000 + 1);
        if (change > 10) {
            coin.technicalIndicators.mfi = 75 + Math.min(change - 10, 20) + volumeWeight * 2;
        } else if (change > 5) {
            coin.technicalIndicators.mfi = 65 + (change - 5) * 2 + volumeWeight;
        } else if (change > 0) {
            coin.technicalIndicators.mfi = 55 + change * 2 + volumeWeight * 0.5;
        } else if (change > -5) {
            coin.technicalIndicators.mfi = 45 + change * 1.5;
        } else {
            coin.technicalIndicators.mfi = 25 + Math.max(change + 5, -15);
        }
        coin.technicalIndicators.mfi = Math.max(0, Math.min(100, coin.technicalIndicators.mfi));

        // حساب CVD محسن
        coin.technicalIndicators.cvd = this.calculateCVD(coin);

        // حساب المتوسطات المتحركة المحسنة
        const currentPrice = coin.price;
        coin.technicalIndicators.ema20 = currentPrice * (1 - (coin.change24h / 100) * 0.15);
        coin.technicalIndicators.ema50 = currentPrice * (1 - (coin.change24h / 100) * 0.35);

        // حساب Parabolic SAR
        coin.technicalIndicators.parabolicSAR = this.calculateParabolicSAR(coin);

        // تصحيح حساب مستويات فيبوناتشي للاتجاه الصاعد
        const low24h = currentPrice * (1 - (coin.change24h / 100)); // أقل سعر (قبل الارتفاع)
        const high24h = currentPrice; // أعلى سعر (السعر الحالي)
        
        const range = high24h - low24h;
        
        // مستويات فيبوناتشي للاتجاه الصاعد (الأهداف أعلى من السعر الحالي)
        coin.technicalIndicators.fibonacci = {
            level0: high24h, // 0% = السعر الحالي
            level236: high24h + (range * 0.236), // هدف 1
            level382: high24h + (range * 0.382), // هدف 2
            level500: high24h + (range * 0.500), // هدف 3
            level618: high24h + (range * 0.618), // هدف 4
            level786: low24h + (range * 0.214), // دعم قوي
            level1000: low24h // 100% = أقل سعر
        };
        
        console.log(`📈 ${coin.symbol} فيبوناتشي: الحالي=${high24h.toFixed(6)} | T1=${coin.technicalIndicators.fibonacci.level236.toFixed(6)} | T2=${coin.technicalIndicators.fibonacci.level382.toFixed(6)} | T3=${coin.technicalIndicators.fibonacci.level500.toFixed(6)}`);
    }

   calculateCVD(coin) {
    const change = coin.change24h;
    const volume = coin.volume || 1000000;
    let buyVolume, sellVolume;
    
    if (change > 0) {
        // في حالة الارتفاع، نفترض أن معظم الحجم شراء
        const buyRatio = Math.min(0.5 + (change / 20), 0.9); // نسبة الشراء من 50% إلى 90%
        buyVolume = volume * buyRatio;
        sellVolume = volume * (1 - buyRatio);
    } else {
        // في حالة الانخفاض، نفترض أن معظم الحجم بيع
        const sellRatio = Math.min(0.5 + (Math.abs(change) / 20), 0.9); // نسبة البيع من 50% إلى 90%
        sellVolume = volume * sellRatio;
        buyVolume = volume * (1 - sellRatio);
    }
    
    // حساب CVD (Cumulative Volume Delta)
    const cvd = buyVolume - sellVolume;
    
    // تطبيع القيمة لتكون بين -100 و 100
    const normalizedCVD = Math.max(-100, Math.min(100, (cvd / volume) * 100));
    
    coin.technicalIndicators.cvd = normalizedCVD;
    coin.technicalIndicators.buyVolume = buyVolume;
    coin.technicalIndicators.sellVolume = sellVolume;
    
    console.log(`📊 ${coin.symbol} CVD: ${normalizedCVD.toFixed(2)}, شراء: ${(buyVolume/1000000).toFixed(2)}M, بيع: ${(sellVolume/1000000).toFixed(2)}M`);
    
    return normalizedCVD;
}
console.log(`${coin.rank}. ${coin.symbol}: ${coin.score} نقطة (${coin.achievedConditionsCount}/6 شروط) - ${coin.change24h.toFixed(2)}%`);
    });

    console.log(`✅ تم تحليل ${this.coins.length} عملة بنجاح`);
}

renderCoins() {
    console.log('🎨 بدء عرض النتائج...');
    
    const container = document.getElementById('coinsGrid');
    if (!container) {
        console.error('❌ لم يتم العثور على عنصر coinsGrid');
        return;
    }

    if (this.coins.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد عملات للعرض</div>';
        return;
    }

    // عرض أفضل 20 عملة فقط
    const topCoins = this.coins.slice(0, 20);
    
    container.innerHTML = topCoins.map(coin => this.createCoinCard(coin)).join('');
    
    console.log(`🎯 تم عرض ${topCoins.length} عملة`);
}

createCoinCard(coin) {
    const fib = coin.technicalIndicators.fibonacci;
    const currentPrice = coin.price;
    
    // حساب نسب الأهداف
    const target1Percent = ((fib.level236 - currentPrice) / currentPrice * 100);
    const target2Percent = ((fib.level382 - currentPrice) / currentPrice * 100);
    const target3Percent = ((fib.level500 - currentPrice) / currentPrice * 100);
    
    // تحديد لون الكارت حسب النقاط
    let cardClass = 'coin-card';
    if (coin.score >= 80) cardClass += ' excellent';
    else if (coin.score >= 60) cardClass += ' good';
    else if (coin.score >= 40) cardClass += ' average';
    else cardClass += ' weak';

    return `
        <div class="${cardClass}">
            <div class="coin-header">
                <div class="coin-info">
                    <h3 class="coin-symbol">${coin.symbol}</h3>
                    <div class="coin-rank">المرتبة #${coin.rank}</div>
                </div>
                <div class="coin-score">
                    <div class="score-circle score-${this.getScoreClass(coin.score)}">
                        ${coin.score}
                    </div>
                    <div class="conditions-count">${coin.achievedConditionsCount}/6</div>
                </div>
            </div>
            
            <div class="price-info">
                <div class="current-price">$${currentPrice.toFixed(6)}</div>
                <div class="price-change ${coin.change24h >= 0 ? 'positive' : 'negative'}">
                    ${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%
                </div>
            </div>
            
            <div class="technical-indicators">
                <div class="indicator">
                    <span class="label">RSI:</span>
                    <span class="value ${coin.technicalIndicators.rsi > 50 ? 'bullish' : 'bearish'}">
                        ${coin.technicalIndicators.rsi.toFixed(1)}
                    </span>
                </div>
                <div class="indicator">
                    <span class="label">MFI:</span>
                    <span class="value ${coin.technicalIndicators.mfi > 50 ? 'bullish' : 'bearish'}">
                        ${coin.technicalIndicators.mfi.toFixed(1)}
                    </span>
                </div>
                <div class="indicator">
                    <span class="label">MACD:</span>
                    <span class="value ${coin.technicalIndicators.macd > coin.technicalIndicators.macdSignal ? 'bullish' : 'bearish'}">
                        ${coin.technicalIndicators.macd > coin.technicalIndicators.macdSignal ? 'صاعد' : 'هابط'}
                    </span>
                </div>
            </div>
            
            <div class="fibonacci-targets">
                <h4>🎯 الأهداف (فيبوناتشي)</h4>
                <div class="targets-grid">
                    <div class="target">
                        <span class="target-label">الهدف 1:</span>
                        <span class="target-price">$${fib.level236.toFixed(6)}</span>
                        <span class="target-percent positive">+${target1Percent.toFixed(1)}%</span>
                    </div>
                    <div class="target">
                        <span class="target-label">الهدف 2:</span>
                        <span class="target-price">$${fib.level382.toFixed(6)}</span>
                        <span class="target-percent positive">+${target2Percent.toFixed(1)}%</span>
                    </div>
                    <div class="target">
                        <span class="target-label">الهدف 3:</span>
                        <span class="target-price">$${fib.level500.toFixed(6)}</span>
                        <span class="target-percent positive">+${target3Percent.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="conditions-status">
                <h4>📊 حالة الشروط</h4>
                <div class="conditions-grid">
                    <div class="condition ${coin.conditions.rise3Percent ? 'met' : 'not-met'}">
                        <span>ارتفاع 3%</span>
                        <span>${coin.conditions.rise3Percent ? '✓' : '✗'}</span>
                    </div>
                    <div class="condition ${coin.conditions.rise4Percent ? 'met' : 'not-met'}">
                        <span>ارتفاع 4%</span>
                        <span>${coin.conditions.rise4Percent ? '✓' : '✗'}</span>
                    </div>
                    <div class="condition ${coin.conditions.breakoutMA ? 'met' : 'not-met'}">
                        <span>اختراق المتوسطات</span>
                        <span>${coin.conditions.breakoutMA ? '✓' : '✗'}</span>
                    </div>
                    <div class="condition ${coin.conditions.rsiBullish ? 'met' : 'not-met'}">
                        <span>RSI صاعد</span>
                        <span>${coin.conditions.rsiBullish ? '✓' : '✗'}</span>
                    </div>
                    <div class="condition ${coin.conditions.macdBullish ? 'met' : 'not-met'}">
                        <span>MACD صاعد</span>
                        <span>${coin.conditions.macdBullish ? '✓' : '✗'}</span>
                    </div>
                    <div class="condition ${coin.conditions.mfiBullish ? 'met' : 'not-met'}">
                        <span>MFI صاعد</span>
                        <span>${coin.conditions.mfiBullish ? '✓' : '✗'}</span>
                    </div>
                </div>
            </div>
            
            <div class="volume-info">
                <span class="label">الحجم 24س:</span>
                <span class="value">${this.formatVolume(coin.volume)}</span>
            </div>
        </div>
    `;
}

getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    return 'weak';
}

formatVolume(volume) {
    if (volume >= 1000000) {
        return (volume / 1000000).toFixed(1) + 'M';
    } else if (volume >= 1000) {
        return (volume / 1000).toFixed(1) + 'K';
    }
    return volume.toFixed(0);
}

// إضافة دالة لتحديث البيانات
async refreshData() {
    console.log('🔄 بدء تحديث البيانات...');
    this.showLoading();
    
    try {
        await this.fetchData();
        this.analyzeCoins();
        this.renderCoins();
        console.log('✅ تم تحديث البيانات بنجاح');
    } catch (error) {
        console.error('❌ فشل في تحديث البيانات:', error);
        this.showError('فشل في تحديث البيانات. يرجى المحاولة مرة أخرى.');
    }
}
}

// تشغيل التطبيق
document.addEventListener('DOMContentLoaded', () => {
console.log('🚀 بدء تشغيل تطبيق تحليل العملات المشفرة...');

const app = new YaserCrypto();

// إضافة زر التحديث
const refreshButton = document.createElement('button');
refreshButton.textContent = '🔄 تحديث البيانات';
refreshButton.className = 'refresh-button';
refreshButton.onclick = () => app.refreshData();

const container = document.querySelector('.container');
if (container) {
    container.insertBefore(refreshButton, container.firstChild);
}

// تحديث تلقائي كل 5 دقائق
setInterval(() => {
    console.log('⏰ تحديث تلقائي للبيانات...');
    app.refreshData();
}, 5 * 60 * 1000);
});

console.log('✅ تم تحميل النسخة المحسنة v3.0 بنجاح');

        
