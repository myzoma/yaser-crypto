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
         this.addSecretButton();
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
        const candlesUrl = `https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT&bar=1H&limit=100`;

        // جلب بيانات التيكر
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

        // جلب البيانات التاريخية
        await this.delay(100); // تأخير قصير بين الطلبات
        const candlesResponse = await fetch(candlesUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        let historicalData = [];
        if (candlesResponse.ok) {
            const candlesData = await candlesResponse.json();
            if (candlesData.data && candlesData.data.length > 0) {
                historicalData = candlesData.data.map(candle => ({
                    timestamp: parseInt(candle[0]),
                    open: parseFloat(candle[1]),
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4]),
                    volume: parseFloat(candle[5]),
                    volumeQuote: parseFloat(candle[6])
                }));
            }
        }

        const ticker = tickerData.data[0];
        const currentPrice = parseFloat(ticker.last);
        const openPrice24h = parseFloat(ticker.open24h);
        const change24h = parseFloat(ticker.changePercent) || (openPrice24h > 0 ? ((currentPrice - openPrice24h) / openPrice24h) * 100 : 0);

        console.log(`📊 ${symbol}: السعر=${currentPrice}, التغيير=${change24h.toFixed(2)}%`);

        const coin = {
            symbol: symbol,
            name: symbol,
            price: currentPrice,
            change24h: change24h,
            volume: parseFloat(ticker.vol24h) || 0,
            high24h: parseFloat(ticker.high24h) || currentPrice,
            low24h: parseFloat(ticker.low24h) || currentPrice,
            historicalData: historicalData,
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
    const historicalData = coin.historicalData || [];
    
    // حساب RSI بناءً على البيانات التاريخية إذا توفرت
    if (historicalData.length >= 14) {
        coin.technicalIndicators.rsi = this.calculateRSI(historicalData);
    } else {
        coin.technicalIndicators.rsi = 50 + (coin.change24h * 0.8);
        if (coin.technicalIndicators.rsi > 100) coin.technicalIndicators.rsi = 100;
        if (coin.technicalIndicators.rsi < 0) coin.technicalIndicators.rsi = 0;
    }

    // حساب MACD
    if (historicalData.length >= 26) {
        const macdData = this.calculateMACD(historicalData);
        coin.technicalIndicators.macd = macdData.macd;
        coin.technicalIndicators.macdSignal = macdData.signal;
    } else {
        coin.technicalIndicators.macd = coin.change24h > 0 ? 0.1 : -0.1;
        coin.technicalIndicators.macdSignal = 0;
    }

    // حساب MFI
    if (historicalData.length >= 14) {
        coin.technicalIndicators.mfi = this.calculateMFI(historicalData);
    } else {
        coin.technicalIndicators.mfi = Math.min(100, 50 + (coin.change24h * 1.2));
    }

    // حساب CVD (Cumulative Volume Delta)
    coin.technicalIndicators.cvd = this.calculateCVD(historicalData, coin);
       // حساب Parabolic SAR
if (historicalData.length >= 2) {
    coin.technicalIndicators.parabolicSAR = this.calculateParabolicSAR(historicalData);
} else {
    coin.technicalIndicators.parabolicSAR = coin.price * 0.98; // قيمة تقديرية
}


    // حساب المتوسطات المتحركة
    const currentPrice = coin.price;
    if (historicalData.length >= 50) {
        coin.technicalIndicators.ema20 = this.calculateEMA(historicalData, 20);
        coin.technicalIndicators.ema50 = this.calculateEMA(historicalData, 50);
    } else {
        coin.technicalIndicators.ema20 = currentPrice;
        coin.technicalIndicators.ema50 = currentPrice * (1 - (coin.change24h / 100) * 0.3);
    }

    // حساب مستويات فيبوناتشي
    const low24h = currentPrice * (1 - (coin.change24h / 100));
    const high24h = currentPrice;
    const range = high24h - low24h;

    coin.technicalIndicators.fibonacci = {
        level0: high24h,
        level236: high24h + (range * 0.236),
        level382: high24h + (range * 0.382),
        level500: high24h + (range * 0.500),
        level618: high24h + (range * 0.618),
        level786: low24h + (range * 0.214),
        level1000: low24h
    };

    console.log(`📈 ${coin.symbol} فيبوناتشي: الحالي=${high24h.toFixed(6)} | T1=${coin.technicalIndicators.fibonacci.level236.toFixed(6)} | T2=${coin.technicalIndicators.fibonacci.level382.toFixed(6)} | T3=${coin.technicalIndicators.fibonacci.level500.toFixed(6)}`);
}

    calculateRSI(historicalData, period = 14) {
    if (historicalData.length < period + 1) {
        return 50; // قيمة افتراضية
    }

    let gains = 0;
    let losses = 0;

    // حساب المتوسط الأولي
    for (let i = 1; i <= period; i++) {
        const change = historicalData[i].close - historicalData[i - 1].close;
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // حساب RSI للفترات المتبقية
    for (let i = period + 1; i < historicalData.length; i++) {
        const change = historicalData[i].close - historicalData[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}
calculateMACD(historicalData, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (historicalData.length < slowPeriod) {
        return { macd: 0, signal: 0 };
    }

    const prices = historicalData.map(d => d.close);
    const ema12 = this.calculateEMAFromPrices(prices, fastPeriod);
    const ema26 = this.calculateEMAFromPrices(prices, slowPeriod);
    
    const macdLine = ema12 - ema26;
    
    // حساب إشارة MACD (EMA للـ MACD نفسه)
    const macdValues = [macdLine]; // في التطبيق الحقيقي نحتاج لحساب MACD لكل نقطة
    const signalLine = macdLine * 0.1; // تبسيط للحساب

    return {
        macd: macdLine,
        signal: signalLine
    };
}
calculateMFI(historicalData, period = 14) {
    if (historicalData.length < period + 1) {
        return 50; // قيمة افتراضية
    }

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = 1; i <= period; i++) {
        const current = historicalData[i];
        const previous = historicalData[i - 1];
        
        const typicalPrice = (current.high + current.low + current.close) / 3;
        const previousTypicalPrice = (previous.high + previous.low + previous.close) / 3;
        const moneyFlow = typicalPrice * current.volume;

        if (typicalPrice > previousTypicalPrice) {
            positiveFlow += moneyFlow;
        } else if (typicalPrice < previousTypicalPrice) {
            negativeFlow += moneyFlow;
        }
    }

    if (negativeFlow === 0) return 100;
    const moneyFlowRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyFlowRatio));
}
calculateCVD(historicalData, coin) {
    if (!historicalData || historicalData.length === 0) {
        // حساب CVD مبسط بناءً على البيانات المتاحة
        const volumeDirection = coin.change24h > 0 ? 1 : -1;
        return {
            value: coin.volume * volumeDirection,
            trend: coin.change24h > 0 ? 'bullish' : 'bearish',
            strength: Math.abs(coin.change24h) > 5 ? 'strong' : 'weak'
        };
    }

    let cvd = 0;
    let previousCvd = 0;

    for (let i = 1; i < historicalData.length; i++) {
        const current = historicalData[i];
        const previous = historicalData[i - 1];

        // تحديد اتجاه الحجم بناءً على إغلاق السعر
        let volumeDirection;
        if (current.close > previous.close) {
            volumeDirection = 1; // صاعد
        } else if (current.close < previous.close) {
            volumeDirection = -1; // هابط
        } else {
            volumeDirection = 0; // محايد
        }

        cvd += current.volume * volumeDirection;
    }

    // تحديد الاتجاه والقوة
    const trend = cvd > previousCvd ? 'bullish' : 'bearish';
    const strength = Math.abs(cvd) > (coin.volume * 10) ? 'strong' : 'weak';

    return {
        value: cvd,
        trend: trend,
        strength: strength
    };
}
calculateEMA(historicalData, period) {
    if (historicalData.length < period) {
        return historicalData[historicalData.length - 1]?.close || 0;
    }

    const prices = historicalData.map(d => d.close);
    return this.calculateEMAFromPrices(prices, period);
}
calculateEMAFromPrices(prices, period) {
    if (prices.length < period) {
        return prices[prices.length - 1] || 0;
    }

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;

    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
}
calculateParabolicSAR(historicalData, step = 0.02, maxStep = 0.2) {
    if (!historicalData || historicalData.length < 2) {
        return 0;
    }

    let sar = historicalData[0].low;
    let trend = 1; // 1 للصاعد، -1 للهابط
    let af = step; // عامل التسارع
    let ep = historicalData[0].high; // النقطة القصوى

    for (let i = 1; i < historicalData.length; i++) {
        const current = historicalData[i];
        const previous = historicalData[i - 1];

        // حساب SAR الجديد
        sar = sar + af * (ep - sar);

        if (trend === 1) { // اتجاه صاعد
            if (current.low <= sar) {
                // تغيير الاتجاه إلى هابط
                trend = -1;
                sar = ep;
                ep = current.low;
                af = step;
            } else {
                if (current.high > ep) {
                    ep = current.high;
                    af = Math.min(af + step, maxStep);
                }
            }
        } else { // اتجاه هابط
            if (current.high >= sar) {
                // تغيير الاتجاه إلى صاعد
                trend = 1;
                sar = ep;
                ep = current.high;
                af = step;
            } else {
                if (current.low < ep) {
                    ep = current.low;
                    af = Math.min(af + step, maxStep);
                }
            }
        }
    }

    return sar;
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
    const cvd = coin.technicalIndicators.cvd;
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

    // إضافة شرط CVD
    if (cvd && cvd.trend === 'bullish' && cvd.strength === 'strong') {
        conditions.cvdBullish = true;
    }

    // حساب عدد الشروط المحققة
    const achievedConditions = Object.keys(conditions).length;

    // الحالات الخاصة
    if (changePercent > 7 && achievedConditions >= 5) {
        conditions.strongRise = true;
    }

    if (changePercent > 9 && achievedConditions === 7) {
        conditions.perfectScore = true;
    }

    // حساب النقاط
    let baseScore = 0;
    if (achievedConditions === 7) {
        baseScore = 100;
    } else if (achievedConditions === 6) {
        baseScore = 85;
    } else if (achievedConditions === 5) {
        baseScore = 70;
    } else if (achievedConditions === 4) {
        baseScore = 55;
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

    console.log(`📊 ${coin.symbol}: الشروط=${achievedConditions}/7, التغيير=${changePercent.toFixed(2)}%, النقاط=${baseScore}`);

    console.log(` - ارتفاع 3%: ${conditions.rise3Percent ? '✓' : '✗'}`);
    console.log(` - ارتفاع 4%: ${conditions.rise4Percent ? '✓' : '✗'}`);
    console.log(` - اختراق المتوسطات: ${conditions.breakoutMA ? '✓' : '✗'} (السعر:${currentPrice} >= EMA20:${ema20} و >= EMA50:${ema50})`);
    console.log(` - RSI > 50: ${conditions.rsiBullish ? '✓' : '✗'} (${rsi})`);
    console.log(` - MACD صاعد: ${conditions.macdBullish ? '✓' : '✗'} (MACD:${macd}, Signal:${macdSignal})`);
    console.log(` - MFI > 50: ${conditions.mfiBullish ? '✓' : '✗'} (${mfi})`);
    console.log(` - CVD صاعد: ${conditions.cvdBullish ? '✓' : '✗'} (${cvd ? cvd.trend + '/' + cvd.strength : 'N/A'})`);
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
        console.log(`${coin.rank}. ${coin.symbol}: ${coin.achievedConditionsCount}/7 شروط, ${coin.change24h.toFixed(2)}%, النقاط=${coin.score}`);
    });
}

  calculateTargets(coin) {
    const fib = coin.technicalIndicators.fibonacci;
    const currentPrice = coin.price;
    const cvd = coin.technicalIndicators.cvd;

    // تعديل الأهداف بناءً على قوة CVD
    let targetMultiplier = 1;
    if (cvd && cvd.strength === 'strong') {
        targetMultiplier = 1.1; // زيادة الأهداف بنسبة 10% للحجم القوي
    }

    coin.targets = {
        entry: currentPrice,
        stopLoss: fib.level786,
        target1: fib.level236 * targetMultiplier,
        target2: fib.level382 * targetMultiplier,
        target3: fib.level500 * targetMultiplier,
        target4: fib.level618 * targetMultiplier
    };

    console.log(`🎯 ${coin.symbol} الأهداف المحدثة: Entry=${coin.targets.entry.toFixed(6)} | T1=${coin.targets.target1.toFixed(6)} | T2=${coin.targets.target2.toFixed(6)} | T3=${coin.targets.target3.toFixed(6)} | SL=${coin.targets.stopLoss.toFixed(6)}`);
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
            <div class="indicator-card">
                <div class="indicator-title">CVD</div>
                <div class="indicator-value">${coin.technicalIndicators.cvd ? coin.technicalIndicators.cvd.value.toFixed(0) : 'N/A'}</div>
                <div style="color: ${coin.technicalIndicators.cvd && coin.technicalIndicators.cvd.trend === 'bullish' ? '#00ff88' : '#ff4757'}; font-size: 0.9rem;">
                    ${coin.technicalIndicators.cvd ? (coin.technicalIndicators.cvd.trend === 'bullish' ? 'حجم صاعد' : 'حجم هابط') : 'غير متاح'}
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
// إضافة زر سري (مخفي)
addSecretButton() {
    // إنشاء منطقة سرية غير مرئية
    const secretArea = document.createElement('div');
    secretArea.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 50px;
        height: 50px;
        background: transparent;
        z-index: 9999;
        cursor: pointer;
    `;
    
    let clickCount = 0;
    secretArea.addEventListener('click', () => {
        clickCount++;
        if (clickCount === 5) { // 5 نقرات سريعة
            const password = prompt('🔐 كلمة المرور:');
            if (password === 'MySecretPassword123') { // نفس كلمة المرور
                window.open('secure-tracker.html', 'secureTracker', 'width=1400,height=900,scrollbars=yes');
            }
            clickCount = 0;
        }
        
        // إعادة تعيين العداد بعد ثانيتين
        setTimeout(() => { clickCount = 0; }, 2000);
    });
    
    document.body.appendChild(secretArea);
}

// استدعاء في init()
async init() {
    this.showLoading();
    await this.fetchData();
    this.analyzeCoins();
    this.renderCoins();
    this.addSecretButton(); // إضافة هذا السطر
}
