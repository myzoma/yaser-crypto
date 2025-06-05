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
        this.refreshTimer = null;
        this.init();
    }

    async init() {
        this.showLoading();
        await this.fetchData();
        this.analyzeCoins();
        this.renderCoins();
        this.startAutoRefresh();

    }
startAutoRefresh() {
    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(() => {
        console.log('🔄 تحديث تلقائي للبيانات...');
        this.refresh();
    }, this.config.refreshInterval || 60000);
    
    console.log(`⏰ تم تفعيل التحديث التلقائي كل ${(this.config.refreshInterval || 60000) / 1000} ثانية`);
}

 showLoading() {
        document.getElementById('coinsGrid').innerHTML = '<div class="loading">يتم التحليل الان .. انتظر قليلا من فضلك ؟...</div>';
    }

    showError(message) {
        document.getElementById('coinsGrid').innerHTML = `<div class="error">${message}</div>`;
    }


async refresh() {
    try {
        await this.fetchData();
        this.analyzeCoins();
        this.renderCoins();
        console.log('✅ تم تحديث البيانات بنجاح');
    } catch (error) {
        console.error('❌ خطأ في التحديث التلقائي:', error);
    }
}
stopAutoRefresh() {
    if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
        console.log('⏹️ تم إيقاف التحديث التلقائي');
    }
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
        const openPrice24h = parseFloat(ticker.open24h);
        // ضع هذا الكود في دالة fetchCoinData() بعد السطر const ticker = tickerData.data[0];

console.log(`🔍 اختبار بيانات ${symbol}:`);
console.log('📊 البيانات الخام من API:');
console.log('- ticker.last (السعر الحالي):', ticker.last);
console.log('- ticker.open24h (سعر الافتتاح):', ticker.open24h);
console.log('- ticker.changePercent (النسبة من API):', ticker.changePercent);
console.log('- نوع البيانات changePercent:', typeof ticker.changePercent);

// استخدم المتغيرات الموجودة أصلاً
const manualCalculation = openPrice24h > 0 ? ((currentPrice - openPrice24h) / openPrice24h) * 100 : 0;

console.log('🧮 الحسابات:');
console.log('- الحساب اليدوي:', manualCalculation.toFixed(4), '%');
console.log('- النسبة من API:', parseFloat(ticker.changePercent));
console.log('- النسبة المستخدمة نهائياً:', change24h);
console.log('-------------------');

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
    // حساب RSI
    coin.technicalIndicators.rsi = 50 + (coin.change24h * 0.8);
    if (coin.technicalIndicators.rsi > 100) coin.technicalIndicators.rsi = 100;
    if (coin.technicalIndicators.rsi < 0) coin.technicalIndicators.rsi = 0;

    // حساب MACD
    coin.technicalIndicators.macd = coin.change24h > 0 ? 0.1 : -0.1;
    coin.technicalIndicators.macdSignal = 0;

    // حساب MFI
    coin.technicalIndicators.mfi = Math.min(100, 50 + (coin.change24h * 1.2));

    // حساب المتوسطات المتحركة
    const currentPrice = coin.price;
    coin.technicalIndicators.ema20 = currentPrice;
    coin.technicalIndicators.ema50 = currentPrice * (1 - (coin.change24h / 100) * 0.3);

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
calculateScore(coin) {
    const conditions = {};
    const changePercent = coin.change24h;
    const rsi = coin.technicalIndicators.rsi;
    const macd = coin.technicalIndicators.macd;
    const macdSignal = coin.technicalIndicators.macdSignal;
    const mfi = coin.technicalIndicators.mfi;
    const currentPrice = coin.price;
    const ema20 = coin.technicalIndicators.ema20;
    const ema50 = coin.technicalIndicators.ema50;

    // فحص الشروط الأساسية
    if (changePercent >= 3) {
        conditions.rise3Percent = true;
    }
    
    if (changePercent >= 4) {
        conditions.rise4Percent = true;
    }
    
    // تصحيح شرط اختراق المتوسطات - السعر يجب أن يكون >= EMA20 و >= EMA50
    if (currentPrice >= ema20 && currentPrice >= ema50) {
        conditions.breakoutMA = true;
    }
    
    if (rsi > 50) {
        conditions.rsiBullish = true;
    }
    
    if (macd > macdSignal) {
        conditions.macdBullish = true;
    }
    
    if (mfi > 50) {
        conditions.mfiBullish = true;
    }

    // حساب عدد الشروط المحققة
    const achievedConditions = Object.keys(conditions).length;
    
    // الحالات الخاصة
    if (changePercent > 7 && achievedConditions >= 4) {
        conditions.strongRise = true;
    }
    
    if (changePercent > 9 && achievedConditions === 6) {
        conditions.perfectScore = true;
    }

    // حساب النقاط
    let baseScore = 0;
    if (achievedConditions === 6) {
        baseScore = 100;
    } else if (achievedConditions === 5) {
        baseScore = 80;
    } else if (achievedConditions === 4) {
        baseScore = 60;
    } else if (achievedConditions === 3) {
        baseScore = 40;
    } else if (achievedConditions === 2) {
        baseScore = 25;
    } else if (achievedConditions === 1) {
        baseScore = 15;
    } else {
        baseScore = 5;
    }

    coin.baseScore = baseScore;
    coin.score = baseScore;
    coin.conditions = conditions;
    coin.achievedConditionsCount = achievedConditions;
    
    console.log(`📊 ${coin.symbol}: الشروط=${achievedConditions}/6, التغيير=${changePercent.toFixed(2)}%, النقاط=${baseScore}`);
    
    console.log(`   - ارتفاع 3%: ${conditions.rise3Percent ? '✓' : '✗'}`);
    console.log(`   - ارتفاع 4%: ${conditions.rise4Percent ? '✓' : '✗'}`);
    console.log(`   - اختراق المتوسطات: ${conditions.breakoutMA ? '✓' : '✗'} (السعر:${currentPrice} >= EMA20:${ema20} و >= EMA50:${ema50})`);
    console.log(`   - RSI > 50: ${conditions.rsiBullish ? '✓' : '✗'} (${rsi})`);
    console.log(`   - MACD صاعد: ${conditions.macdBullish ? '✓' : '✗'} (MACD:${macd}, Signal:${macdSignal})`);
    console.log(`   - MFI > 50: ${conditions.mfiBullish ? '✓' : '✗'} (${mfi})`);
}


    analyzeCoins() {
        console.log('🔍 بدء تحليل العملات...');
        
        this.coins.forEach(coin => {
            this.calculateScore(coin);
        });
        
        // ترتيب العملات
        this.coins.sort((a, b) => {
            if (a.achievedConditionsCount !== b.achievedConditionsCount) {
                return b.achievedConditionsCount - a.achievedConditionsCount;
            }
            return b.change24h - a.change24h;
        });
        
        // تطبيق نظام الخصم التدريجي
        for (let i = 0; i < this.coins.length; i++) {
            const coin = this.coins[i];
            coin.rank = i + 1;
            
            if (i === 0) {
                coin.finalScore = coin.baseScore;
            } else {
                const previousCoin = this.coins[i - 1];
                const deduction = coin.rank;
                coin.finalScore = Math.max(previousCoin.finalScore - deduction, 0);
            }
            
            coin.score = coin.finalScore;
        }
        
        console.log('🏆 الترتيب النهائي:');
        this.coins.slice(0, 10).forEach(coin => {
            console.log(`${coin.rank}. ${coin.symbol}: ${coin.achievedConditionsCount}/6 شروط, ${coin.change24h.toFixed(2)}%, النقاط=${coin.score}`);
        });
    }
   calculateTargets(coin) {
    const fib = coin.technicalIndicators.fibonacci;
    const currentPrice = coin.price;
    
    coin.targets = {
        entry: currentPrice, // الدخول بالسعر الحالي
        stopLoss: fib.level786, // وقف خسارة عند دعم قوي
        target1: fib.level236, // هدف 1 (أعلى من السعر)
        target2: fib.level382, // هدف 2
        target3: fib.level500, // هدف 3
        target4: fib.level618  // هدف 4
    };
    
    console.log(`🎯 ${coin.symbol} الأهداف المصححة: Entry=${coin.targets.entry.toFixed(6)} | T1=${coin.targets.target1.toFixed(6)} | T2=${coin.targets.target2.toFixed(6)} | T3=${coin.targets.target3.toFixed(6)} | SL=${coin.targets.stopLoss.toFixed(6)}`);
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
 renderResults() {
    const container = document.getElementById('results');
    if (!container) return;

    container.innerHTML = this.coins.slice(0, 10).map((coin, index) => {
        const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${coin.rank}`;
        
        return `
            <div class="coin-card ${index < 3 ? 'top-coin' : ''}">
                <div class="coin-header">
                    <span class="rank">${rankEmoji}</span>
                    <span class="symbol">${coin.symbol}</span>
                    <span class="price">$${coin.price}</span>
                    <span class="change ${coin.change24h >= 0 ? 'positive' : 'negative'}">
                        ${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%
                    </span>
                </div>
                
                <div class="score-section">
                    <span class="score">النقاط:${coin.score}</span>
                    <span class="conditions">${coin.achievedConditionsCount}/6 شروط</span>
                </div>
                
                <div class="targets-section">
                    <div class="targets-title">🎯 أهداف فيبوناتشي:</div>
                    <div class="targets-grid">
                        <span class="entry">دخول: $${coin.targets.entry.toFixed(6)}</span>
                        <span class="target">T1: $${coin.targets.target1.toFixed(6)}</span>
                        <span class="target">T2: $${coin.targets.target2.toFixed(6)}</span>
                        <span class="target">T3: $${coin.targets.target3.toFixed(6)}</span>
                        <span class="stop-loss">وقف: $${coin.targets.stopLoss.toFixed(6)}</span>
                    </div>
                </div>
                
                <div class="indicators">
                    <span>حجم التداول:${(coin.volume / 1000).toFixed(1)}K</span>
                    <span>RSI:${coin.technicalIndicators.rsi.toFixed(1)}</span>
                    <span>MFI:${coin.technicalIndicators.mfi.toFixed(1)}</span>
                </div>
                
                <div class="liquidity-bar">
                    <div class="liquidity-fill" style="width: ${Math.min(coin.volume / 10000, 100)}%"></div>
                    <span>شريط السيولة</span>
                </div>
            </div>
        `;
    }).join('');
}

    analyzeCoins() {
    console.log('🔍 بدء تحليل العملات...');
    
    this.coins.forEach(coin => {
        this.calculateScore(coin);
        this.calculateTargets(coin); // إضافة هذا السطر
    });
    
    // ترتيب العملات
    this.coins.sort((a, b) => {
        if (a.achievedConditionsCount !== b.achievedConditionsCount) {
            return b.achievedConditionsCount - a.achievedConditionsCount;
        }
        return b.change24h - a.change24h;
    });
    
    // تطبيق نظام الخصم التدريجي
    for (let i = 0; i < this.coins.length; i++) {
        const coin = this.coins[i];
        coin.rank = i + 1;
        
        if (i === 0) {
            coin.finalScore = coin.baseScore;
        } else {
            const previousCoin = this.coins[i - 1];
            const deduction = coin.rank;
            coin.finalScore = Math.max(previousCoin.finalScore - deduction, 1);
        }
        
        coin.score = coin.finalScore;
    }
    
    console.log('🏆 الترتيب النهائي مع أهداف فيبوناتشي:');
    this.coins.slice(0, 10).forEach(coin => {
        console.log(`${coin.rank}. ${coin.symbol}: ${coin.achievedConditionsCount}/6 شروط, ${coin.change24h.toFixed(2)}%, النقاط=${coin.score}`);
        console.log(`   🎯 الأهداف: Entry=${coin.targets.entry.toFixed(6)} | T1=${coin.targets.target1.toFixed(6)} | T2=${coin.targets.target2.toFixed(6)} | SL=${coin.targets.stopLoss.toFixed(6)}`);
    });
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
        rise3Percent: 'ارتفاع 3% - 8 نقاط',
        rise4Percent: 'ارتفاع 4% - 12 نقطة',         
        breakoutMA: 'اختراق المتوسطات - 18 نقطة',
        rsiBullish: 'RSI فوق 50 - 15 نقطة',
        macdBullish: 'MACD تقاطع صاعد - 22 نقطة',
        mfiBullish: 'MFI فوق 50 - 25 نقطة',
        strongRise: 'ارتفاع قوي +7% - بونص 20 نقطة',
        perfectScore: 'جميع الشروط +9% - بونص 10 نقاط'
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



