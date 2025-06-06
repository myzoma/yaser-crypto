class YaserCrypto {
   // إضافة إعدادات CVD الأصلي
constructor() {
    this.coins = [];
    this.config = {
        apiUrl: "https://www.okx.com/api/v5",
        requestDelay: 500,
        maxCoins: 50,
        minChange: 1,
        maxChange: 15,
        minVolume: 100000,
        // إعدادات CVD الأصلي
        cvd: {
            lookbackPeriod: 24,      // 24 ساعة
            tickSize: 100,           // حجم التجميع
            smoothingPeriod: 14,     // فترة التنعيم
            significantThreshold: 0.1, // عتبة الصفقات المهمة
            cumulativePeriods: [1, 4, 12, 24] // فترات التجميع بالساعات
        }
    };
    this.requestDelay = 500;
    this.init();
}

// جلب بيانات الصفقات الفعلية
async fetchTradeData(symbol) {
    try {
        // محاولة جلب بيانات الصفقات الأخيرة
        const tradesUrl = `${this.config.apiUrl}/market/trades?instId=${symbol}-USDT&limit=500`;
        
        const response = await fetch(tradesUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`فشل في جلب بيانات الصفقات: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
            console.warn(`لا توجد بيانات صفقات لـ ${symbol}, سيتم استخدام الطريقة البديلة`);
            return null;
        }

        return data.data.map(trade => ({
            price: parseFloat(trade.px),
            size: parseFloat(trade.sz),
            side: trade.side, // buy أو sell
            timestamp: parseInt(trade.ts)
        }));

    } catch (error) {
        console.warn(`فشل في جلب بيانات الصفقات لـ ${symbol}:`, error.message);
        return null;
    }
}

// جلب بيانات الشموع عالية الدقة
async fetchHighResolutionCandles(symbol) {
    try {
        const periods = ['1m', '5m', '15m', '1H'];
        const candlePromises = periods.map(period => 
            fetch(`${this.config.apiUrl}/market/candles?instId=${symbol}-USDT&bar=${period}&limit=100`)
                .then(res => res.json())
                .then(data => ({ period, data: data.data || [] }))
        );

        const results = await Promise.all(candlePromises);
        
        const candleData = {};
        results.forEach(result => {
            candleData[result.period] = result.data;
        });

        return candleData;

    } catch (error) {
        console.error(`فشل في جلب بيانات الشموع عالية الدقة لـ ${symbol}:`, error);
        return null;
    }
}

// حساب CVD الأصلي الحقيقي
async calculateOriginalCVD(coin) {
    try {
        console.log(`🔄 حساب CVD الأصلي لـ ${coin.symbol}...`);

        // محاولة جلب بيانات الصفقات أولاً
        const trades = await this.fetchTradeData(coin.symbol);
        
        let cvdData;
        
        if (trades && trades.length > 0) {
            // الطريقة الأصلية: حساب من الصفقات الفعلية
            cvdData = this.calculateCVDFromTrades(trades, coin);
            console.log(`✅ ${coin.symbol}: CVD محسوب من ${trades.length} صفقة فعلية`);
        } else {
            // الطريقة البديلة: حساب من الشموع عالية الدقة
            const candles = await this.fetchHighResolutionCandles(coin.symbol);
            cvdData = this.calculateCVDFromCandles(candles, coin);
            console.log(`⚠️ ${coin.symbol}: CVD محسوب من الشموع (بديل)`);
        }

        coin.technicalIndicators.cvd = cvdData;
        
    } catch (error) {
        console.error(`❌ فشل في حساب CVD لـ ${coin.symbol}:`, error);
        coin.technicalIndicators.cvd = this.getDefaultCVD();
    }
}

// حساب CVD من الصفقات الفعلية (الطريقة الأصلية)
calculateCVDFromTrades(trades, coin) {
    const config = this.config.cvd;
    const now = Date.now();
    const lookbackMs = config.lookbackPeriod * 60 * 60 * 1000; // 24 ساعة
    
    // فلترة الصفقات حسب الوقت
    const recentTrades = trades.filter(trade => 
        (now - trade.timestamp) <= lookbackMs
    );

    let cumulativeDelta = 0;
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let totalVolume = 0;
    let significantTrades = 0;
    
    // تجميع البيانات حسب الفترات
    const periodData = {};
    config.cumulativePeriods.forEach(period => {
        periodData[period] = { delta: 0, buyVol: 0, sellVol: 0, trades: 0 };
    });

    recentTrades.forEach(trade => {
        const volume = trade.size;
        const tradeValue = trade.price * volume;
        
        totalVolume += volume;
        
        if (trade.side === 'buy') {
            totalBuyVolume += volume;
            cumulativeDelta += volume;
        } else {
            totalSellVolume += volume;
            cumulativeDelta -= volume;
        }
        
        // تحديد الصفقات المهمة
        if (tradeValue > (coin.price * config.significantThreshold)) {
            significantTrades++;
        }
        
        // تجميع البيانات حسب الفترات
        config.cumulativePeriods.forEach(period => {
            const periodMs = period * 60 * 60 * 1000;
            if ((now - trade.timestamp) <= periodMs) {
                periodData[period].trades++;
                if (trade.side === 'buy') {
                    periodData[period].buyVol += volume;
                    periodData[period].delta += volume;
                } else {
                    periodData[period].sellVol += volume;
                    periodData[period].delta -= volume;
                }
            }
        });
    });

    // حساب المؤشرات المتقدمة
    const cvdPercentage = totalVolume > 0 ? (cumulativeDelta / totalVolume) * 100 : 0;
    const buyPressure = totalVolume > 0 ? (totalBuyVolume / totalVolume) * 100 : 50;
    const sellPressure = totalVolume > 0 ? (totalSellVolume / totalVolume) * 100 : 50;
    const volumeImbalance = totalBuyVolume > 0 ? totalSellVolume / totalBuyVolume : 1;
    
    // حساب قوة الاتجاه
    const momentum = this.calculateCVDMomentum(periodData);
    const divergence = this.calculatePriceCVDDivergence(coin, cvdPercentage);
    
    // تحديد الإشارة النهائية
    const signal = this.determineCVDSignal(cvdPercentage, momentum, divergence, buyPressure);

    return {
        // القيم الأساسية
        value: cvdPercentage,
        cumulativeDelta: cumulativeDelta,
        totalVolume: totalVolume,
        
        // ضغط الشراء والبيع
        buyVolume: totalBuyVolume,
        sellVolume: totalSellVolume,
        buyPressure: buyPressure,
        sellPressure: sellPressure,
        volumeImbalance: volumeImbalance,
        
        // التحليل المتقدم
        momentum: momentum,
        divergence: divergence,
        signal: signal.action,
        strength: signal.strength,
        confidence: signal.confidence,
        
        // بيانات الفترات
        periods: periodData,
        
        // إحصائيات إضافية
        totalTrades: recentTrades.length,
        significantTrades: significantTrades,
        averageTradeSize: totalVolume / recentTrades.length,
        
        // التصنيف النهائي
        trend: this.classifyCVDTrend(cvdPercentage, momentum, signal.strength),
        quality: this.assessDataQuality(recentTrades.length, totalVolume, coin.volume)
    };
}

// حساب زخم CVD
calculateCVDMomentum(periodData) {
    const periods = Object.keys(periodData).map(Number).sort((a, b) => a - b);
    
    let momentum = 0;
    for (let i = 1; i < periods.length; i++) {
        const current = periodData[periods[i]].delta;
        const previous = periodData[periods[i-1]].delta;
        
        if (previous !== 0) {
            momentum += (current - previous) / Math.abs(previous);
        }
    }
    
    return momentum / (periods.length - 1);
}

// حساب التباعد بين السعر و CVD
calculatePriceCVDDivergence(coin, cvdValue) {
    const priceChange = coin.change24h;
    
    // تباعد إيجابي: السعر هابط لكن CVD صاعد
    if (priceChange < -2 && cvdValue > 5) {
        return { type: 'bullish', strength: Math.abs(priceChange) + cvdValue };
    }
    
    // تباعد سلبي: السعر صاعد لكن CVD هابط
    if (priceChange > 2 && cvdValue < -5) {
        return { type: 'bearish', strength: priceChange + Math.abs(cvdValue) };
    }
    
    return { type: 'none', strength: 0 };
}

// تحديد إشارة CVD النهائية
determineCVDSignal(cvdValue, momentum, divergence, buyPressure) {
    let action = 'hold';
    let strength = 0;
    let confidence = 0;
    
    // تحليل القيمة الأساسية
    if (cvdValue > 20) {
        action = 'strong_buy';
        strength = 90;
    } else if (cvdValue > 10) {
        action = 'buy';
        strength = 70;
    } else if (cvdValue > 5) {
        action = 'weak_buy';
        strength = 50;
    } else if (cvdValue < -20) {
        action = 'strong_sell';
        strength = 90;
    } else if (cvdValue < -10) {
        action = 'sell';
        strength = 70;
    } else if (cvdValue < -5) {
        action = 'weak_sell';
        strength = 50;
    }
    
    // تعديل حسب الزخم
    if (momentum > 0.1) {
        strength += 10;
    } else if (momentum < -0.1) {
        strength -= 10;
    }
    
    // تعديل حسب التباعد
    if (divergence.type === 'bullish' && action.includes('buy')) {
        strength += 15;
    } else if (divergence.type === 'bearish' && action.includes('sell')) {
        strength += 15;
    }
    
    // تعديل حسب ضغط الشراء
    if (buyPressure > 70) {
        strength += 5;
    } else if (buyPressure < 30) {
        strength -= 5;
    }
    
    // حساب الثقة
    confidence = Math.min(Math.max(strength, 0), 100);
    
    return { action, strength: Math.min(Math.max(strength, 0), 100), confidence };
}

// تصنيف اتجاه CVD
classifyCVDTrend(cvdValue, momentum, strength) {
    if (cvdValue > 15 && momentum > 0.05 && strength > 80) {
        return 'very_bullish';
    } else if (cvdValue > 8 && strength > 60) {
        return 'bullish';
    } else if (cvdValue > 3 && strength > 40) {
        return 'weak_bullish';
    } else if (cvdValue < -15 && momentum < -0.05 && strength > 80) {
        return 'very_bearish';
    } else if (cvdValue < -8 && strength > 60) {
        return 'bearish';
    } else if (cvdValue < -3 && strength > 40) {
        return 'weak_bearish';
    } else {
        return 'neutral';
    }
}

// تقييم جودة البيانات
assessDataQuality(tradesCount, calculatedVolume, reportedVolume) {
    let quality = 'excellent';
    let score = 100;
    
    // تقييم عدد الصفقات
    if (tradesCount < 50) {
        quality = 'poor';
        score -= 40;
    } else if (tradesCount < 200) {
        quality = 'fair';
        score -= 20;
    } else if (tradesCount < 500) {
        quality = 'good';
        score -= 10;
    }
    
    // تقييم تطابق الحجم
    if (reportedVolume > 0) {
        const volumeAccuracy = Math.abs(calculatedVolume - reportedVolume) / reportedVolume;
        if (volumeAccuracy > 0.3) {
            score -= 30;
            quality = quality === 'excellent' ? 'good' : 'poor';
        } else if (volumeAccuracy > 0.1) {
            score -= 15;
        }
    }
    
    return { quality, score: Math.max(score, 0) };
}

// حساب CVD من الشموع (الطريقة البديلة المحسنة)
calculateCVDFromCandles(candlesData, coin) {
    if (!candlesData || Object.keys(candlesData).length === 0) {
        return this.getDefaultCVD();
    }
    
    console.log(`📊 حساب CVD من الشموع لـ ${coin.symbol}`);
    
    // استخدام الشموع دقيقة واحدة للدقة العالية
    const oneMinCandles = candlesData['1m'] || candlesData['5m'] || candlesData['15m'] || candlesData['1H'];
    
    if (!oneMinCandles || oneMinCandles.length === 0) {
        return this.getDefaultCVD();
    }
    
    let cumulativeDelta = 0;
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let totalVolume = 0;
    let strongCandles = 0;
    
    // تحليل كل شمعة بدقة عالية
    oneMinCandles.forEach(candleData => {
        const [timestamp, open, high, low, close, volume, volumeCurrency] = candleData.map(parseFloat);
        
        if (volume <= 0) return;
        
        totalVolume += volume;
        
        // حساب خصائص الشمعة
        const bodySize = Math.abs(close - open);
        const upperWick = high - Math.max(open, close);
        const lowerWick = Math.min(open, close) - low;
        const totalRange = high - low;
        
        // تحديد قوة الشمعة
        const bodyRatio = totalRange > 0 ? bodySize / totalRange : 0;
        const isGreenCandle = close > open;
        const isRedCandle = close < open;
        const isDoji = bodySize < (totalRange * 0.1);
        
        // حساب توزيع الحجم المتقدم
        let buyVolume, sellVolume;
        
        if (isDoji) {
            // شمعة دوجي - توزيع متساوي
            buyVolume = volume * 0.5;
            sellVolume = volume * 0.5;
        } else if (isGreenCandle) {
            // شمعة خضراء - حساب متقدم
            let buyRatio = 0.5 + (bodyRatio * 0.3); // 50-80%
            
            // تعديل حسب الفتائل
            if (lowerWick > upperWick * 2) {
                buyRatio += 0.1; // دعم قوي
            } else if (upperWick > lowerWick * 2) {
                buyRatio -= 0.1; // مقاومة قوية
            }
            
            // تعديل حسب موقع الإغلاق
            const closePosition = totalRange > 0 ? (close - low) / totalRange : 0.5;
            buyRatio += (closePosition - 0.5) * 0.2;
            
            buyRatio = Math.min(Math.max(buyRatio, 0.3), 0.9);
            buyVolume = volume * buyRatio;
            sellVolume = volume * (1 - buyRatio);
            
        } else if (isRedCandle) {
            // شمعة حمراء - حساب متقدم
            let sellRatio = 0.5 + (bodyRatio * 0.3); // 50-80%
            
            // تعديل حسب الفتائل
            if (upperWick > lowerWick * 2) {
                sellRatio += 0.1; // مقاومة قوية
            } else if (lowerWick > upperWick * 2) {
                sellRatio -= 0.1; // دعم قوي
            }
            
            // تعديل حسب موقع الإغلاق
            const closePosition = totalRange > 0 ? (high - close) / totalRange : 0.5;
            sellRatio += (closePosition - 0.5) * 0.2;
            
            sellRatio = Math.min(Math.max(sellRatio, 0.3), 0.9);
            sellVolume = volume * sellRatio;
            buyVolume = volume * (1 - sellRatio);
        }
        
        totalBuyVolume += buyVolume;
        totalSellVolume += sellVolume;
        cumulativeDelta += (buyVolume - sellVolume);
        
        // عد الشموع القوية
        if (bodyRatio > 0.6 && volume > (totalVolume / oneMinCandles.length * 1.5)) {
            strongCandles++;
        }
    });
    
    // حساب المؤشرات النهائية
    const cvdPercentage = totalVolume > 0 ? (cumulativeDelta / totalVolume) * 100 : 0;
    const buyPressure = totalVolume > 0 ? (totalBuyVolume / totalVolume) * 100 : 50;
    const sellPressure = totalVolume > 0 ? (totalSellVolume / totalVolume) * 100 : 50;
    
    // حساب الزخم من الشموع الأخيرة
    const recentCandles = oneMinCandles.slice(0, 10);
    let recentDelta = 0;
    recentCandles.forEach(candleData => {
        const [, open, , , close, volume] = candleData.map(parseFloat);
        const isGreen = close > open;
        recentDelta += isGreen ? volume : -volume;
    });
    const momentum = recentDelta / (totalVolume * 0.1); // نسبة من 10% من الحجم
    
    // حساب التباعد
    const divergence = this.calculatePriceCVDDivergence(coin, cvdPercentage);
    
    // تحديد الإشارة
    const signal = this.determineCVDSignal(cvdPercentage, momentum, divergence, buyPressure);
    
    return {
        // القيم الأساسية
        value: cvdPercentage,
        cumulativeDelta: cumulativeDelta,
        totalVolume: totalVolume,
        
        // ضغط الشراء والبيع
        buyVolume: totalBuyVolume,
        sellVolume: totalSellVolume,
        buyPressure: buyPressure,
        sellPressure: sellPressure,
        volumeImbalance: totalBuyVolume > 0 ? totalSellVolume / totalBuyVolume : 1,
        
        // التحليل المتقدم
        momentum: momentum,
        divergence: divergence,
        signal: signal.action,
        strength: signal.strength,
        confidence: signal.confidence,
        
        // إحصائيات الشموع
        totalCandles: oneMinCandles.length,
        strongCandles: strongCandles,
        candleQuality: strongCandles / oneMinCandles.length,
        
        // التصنيف النهائي
        trend: this.classifyCVDTrend(cvdPercentage, momentum, signal.strength),
        quality: this.assessCandleDataQuality(oneMinCandles.length, totalVolume, coin.volume),
        dataSource: 'candles'
    };
}

// تقييم جودة بيانات الشموع
assessCandleDataQuality(candlesCount, calculatedVolume, reportedVolume) {
    let quality = 'good';
    let score = 80; // الشموع أقل دقة من الصفقات المباشرة
    
    if (candlesCount < 20) {
        quality = 'poor';
        score = 40;
    } else if (candlesCount < 50) {
        quality = 'fair';
        score = 60;
    } else if (candlesCount >= 100) {
        quality = 'excellent';
        score = 90;
    }
    
    // تحقق من تطابق الحجم
    if (reportedVolume > 0) {
        const volumeAccuracy = Math.abs(calculatedVolume - reportedVolume) / reportedVolume;
        if (volumeAccuracy > 0.2) {
            score -= 20;
        } else if (volumeAccuracy > 0.1) {
            score -= 10;
        }
    }
    
    return { quality, score: Math.max(score, 0) };
}

// القيم الافتراضية الآمنة
getDefaultCVD() {
    return {
        value: 0,
        cumulativeDelta: 0,
        totalVolume: 0,
        buyVolume: 0,
        sellVolume: 0,
        buyPressure: 50,
        sellPressure: 50,
        volumeImbalance: 1,
        momentum: 0,
        divergence: { type: 'none', strength: 0 },
        signal: 'hold',
        strength: 0,
        confidence: 0,
        trend: 'neutral',
        quality: { quality: 'no_data', score: 0 },
        dataSource: 'default'
    };
}

// تحديث دالة calculateTechnicalIndicators
calculateTechnicalIndicators(coin) {
    // الحسابات الموجودة...
    coin.technicalIndicators.rsi = 50 + (coin.change24h * 0.8);
    if (coin.technicalIndicators.rsi > 100) coin.technicalIndicators.rsi = 100;
    if (coin.technicalIndicators.rsi < 0) coin.technicalIndicators.rsi = 0;

    coin.technicalIndicators.macd = coin.change24h > 0 ? 0.1 : -0.1;
    coin.technicalIndicators.macdSignal = 0;

    coin.technicalIndicators.mfi = Math.min(100, 50 + (coin.change24h * 1.2));

    const currentPrice = coin.price;
    coin.technicalIndicators.ema20 = currentPrice;
    coin.technicalIndicators.ema50 = currentPrice * (1 - (coin.change24h / 100) * 0.3);

    // حساب CVD الأصلي (async)
    this.calculateOriginalCVD(coin).catch(error => {
        console.error(`فشل في حساب CVD لـ ${coin.symbol}:`, error);
        coin.technicalIndicators.cvd = this.getDefaultCVD();
    });

    // حساب فيبوناتشي...
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
}

// تحديث دالة calculateScore مع شروط CVD الأصلي
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
    const cvd = coin.technicalIndicators.cvd;

    // الشروط الأساسية الموجودة
    if (changePercent >= 3) conditions.rise3Percent = true;
    if (changePercent >= 4) conditions.rise4Percent = true;
    if (currentPrice >= ema20 && currentPrice >= ema50) conditions.breakoutMA = true;
    if (rsi > 50) conditions.rsiBullish = true;
    if (macd > macdSignal) conditions.macdBullish = true;
    if (mfi > 50) conditions.mfiBullish = true;

    // شروط CVD الأصلي المتقدمة
    
    // 1. CVD إيجابي قوي
    if (cvd.signal === 'strong_buy' || (cvd.signal === 'buy' && cvd.confidence > 70)) {
        conditions.cvdStrongBuy = true;
    }
    
    // 2. ضغط شراء مهيمن
    if (cvd.buyPressure > 65 && cvd.volumeImbalance < 0.8) {
        conditions.cvdBuyDominance = true;
    }
    
    // 3. زخم CVD إيجابي
    if (cvd.momentum > 0.1 && cvd.value > 5) {
        conditions.cvdPositiveMomentum = true;
    }
    
    // 4. تباعد إيجابي (السعر منخفض لكن CVD مرتفع)
    if (cvd.divergence.type === 'bullish' && cvd.divergence.strength > 8) {
        conditions.cvdBullishDivergence = true;
    }
    
    // 5. جودة البيانات عالية
    if (cvd.quality.score > 70 && cvd.confidence > 60) {
        conditions.cvdHighQuality = true;
    }
    
    // 6. قوة الاتجاه
    if (cvd.trend === 'very_bullish' || (cvd.trend === 'bullish' && cvd.strength > 75)) {
        conditions.cvdStrongTrend = true;
    }
    
    // 7. تأكيد الحجم
    if (cvd.totalVolume > (coin.volume * 0.8) && cvd.buyVolume > cvd.sellVolume * 1.3) {
        conditions.cvdVolumeConfirmation = true;
    }

    // حساب عدد الشروط المحققة (الآن 13 شرط)
    const achievedConditions = Object.keys(conditions).length;

    // تحديث حساب النقاط للشروط الثلاثة عشر
    let baseScore = 0;
    if (achievedConditions >= 12) {
        baseScore = 100;
    } else if (achievedConditions >= 10) {
        baseScore = 90;
    } else if (achievedConditions >= 8) {
        baseScore = 80;
    } else if (achievedConditions >= 6) {
        baseScore = 65;
    } else if (achievedConditions >= 4) {
        baseScore = 45;
    } else if (achievedConditions >= 2) {
        baseScore = 25;
    } else if (achievedConditions >= 1) {
        baseScore = 10;
    } else {
        baseScore = 0;
    }

    coin.baseScore = baseScore;
    coin.score = baseScore;
    coin.conditions = conditions;
    coin.achievedConditionsCount = achievedConditions;

    console.log(`📊 ${coin.symbol}: الشروط=${achievedConditions}/13, التغيير=${changePercent.toFixed(2)}%, النقاط=${baseScore}`);
    
    // عرض شروط CVD
    console.log(`   🔹 CVD شراء قوي: ${conditions.cvdStrongBuy ? '✓' : '✗'} (${cvd.signal}, ثقة: ${cvd.confidence}%)`);
    console.log(`   🔹 هيمنة الشراء: ${conditions.cvdBuyDominance ? '✓' : '✗'} (ضغط: ${cvd.buyPressure.toFixed(1)}%)`);
    console.log(`   🔹 زخم إيجابي: ${conditions.cvdPositiveMomentum ? '✓' : '✗'} (زخم: ${cvd.momentum.toFixed(3)})`);
    console.log(`   🔹 تباعد إيجابي: ${conditions.cvdBullishDivergence ? '✓' : '✗'} (${cvd.divergence.type})`);
    console.log(`   🔹 جودة عالية: ${conditions.cvdHighQuality ? '✓' : '✗'} (جودة: ${cvd.quality.score})`);
    console.log(`   🔹 اتجاه قوي: ${conditions.cvdStrongTrend ? '✓' : '✗'} (${cvd.trend})`);
    console.log(`   🔹 تأكيد الحجم: ${conditions.cvdVolumeConfirmation ? '✓' : '✗'}`);
}

// تحديث دالة fetchCoinData لتكون متزامنة مع CVD
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
            technicalIndicators: {},
            score: 0,
            rank: 0,
            conditions: {},
            targets: {}
        };

        // حساب المؤشرات الفنية (بما في ذلك CVD)
        await this.calculateTechnicalIndicatorsAsync(coin);
        
        return coin;

    } catch (error) {
        console.error(`خطأ في جلب بيانات ${symbol}:`, error);
        throw error;
    }
}

// دالة حساب المؤشرات الفنية المتزامنة
async calculateTechnicalIndicatorsAsync(coin) {
    // حساب المؤشرات الأساسية
    coin.technicalIndicators.rsi = 50 + (coin.change24h * 0.8);
    if (coin.technicalIndicators.rsi > 100) coin.technicalIndicators.rsi = 100;
    if (coin.technicalIndicators.rsi < 0) coin.technicalIndicators.rsi = 0;

    coin.technicalIndicators.macd = coin.change24h > 0 ? 0.1 : -0.1;
    coin.technicalIndicators.macdSignal = 0;

    coin.technicalIndicators.mfi = Math.min(100, 50 + (coin.change24h * 1.2));

    const currentPrice = coin.price;
    coin.technicalIndicators.ema20 = currentPrice;
    coin.technicalIndicators.ema50 = currentPrice * (1 - (coin.change24h / 100) * 0.3);

    // حساب CVD الأصلي (متزامن)
    await this.calculateOriginalCVD(coin);

    // حساب فيبوناتشي
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

    console.log(`📈 ${coin.symbol} CVD: ${coin.technicalIndicators.cvd.value.toFixed(2)}% | اتجاه: ${coin.technicalIndicators.cvd.trend} | إشارة: ${coin.technicalIndicators.cvd.signal}`);
}

// تحديث دالة العرض لإظهار CVD الأصلي
renderCoins() {
    const container = document.getElementById('coinsGrid');
    if (!container) return;

    if (this.coins.length === 0) {
        container.innerHTML = '<div class="no-data">لا توجد عملات تحقق المعايير المطلوبة</div>';
        return;
    }

    container.innerHTML = this.coins.slice(0, this.config.maxCoins).map(coin => {
        const cvd = coin.technicalIndicators.cvd;
        const cvdTrendClass = this.getCVDTrendClass(cvd.trend);
        const cvdSignalClass = this.getCVDSignalClass(cvd.signal);
        
        return `
            <div class="coin-card rank-${coin.rank}" data-cvd-trend="${cvd.trend}">
                <div class="coin-header">
                    <h3>${coin.symbol}</h3>
                    <span class="rank">#${coin.rank}</span>
                    <span class="cvd-quality ${cvd.quality.quality}">${cvd.quality.quality}</span>
                </div>
                
                <div class="coin-metrics">
                    <div class="metric">
                        <span class="label">السعر:</span>
                        <span class="value">${coin.price.toFixed(6)}</span>
                    </div>
                    <div class="metric">
                        <span class="label">التغيير 24س:</span>
                        <span class="value positive">+${coin.change24h.toFixed(2)}%</span>
                    </div>
                    <div class="metric">
                        <span class="label">الحجم:</span>
                        <span class="value">${coin.volume.toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="cvd-section">
                    <div class="cvd-header">
                        <h4>مؤشر CVD الأصلي</h4>
                        <span class="cvd-confidence">ثقة: ${cvd.confidence}%</span>
                    </div>
                    
                    <div class="cvd-metrics">
                        <div class="cvd-metric">
                            <span class="label">القيمة:</span>
                            <span class="value ${cvdTrendClass}">${cvd.value.toFixed(2)}%</span>
                        </div>
                        <div class="cvd-metric">
                            <span class="label">الإشارة:</span>
                            <span class="value ${cvdSignalClass}">${this.translateCVDSignal(cvd.signal)}</span>
                        </div>
                        <div class="cvd-metric">
                            <span class="label">الاتجاه:</span>
                            <span class="value ${cvdTrendClass}">${this.translateCVDTrend(cvd.trend)}</span>
                        </div>
                    </div>
                    
                    <div class="volume-pressure">
                        <div class="pressure-bar">
                            <div class="buy-pressure" style="width: ${cvd.buyPressure}%">
                                <span>شراء: ${cvd.buyPressure.toFixed(1)}%</span>
                            </div>
                            <div class="sell-pressure" style="width: ${cvd.sellPressure}%">
                                <span>بيع: ${cvd.sellPressure.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                    
                    ${cvd.divergence.type !== 'none' ? `
                        <div class="divergence-alert ${cvd.divergence.type}">
                            <span class="icon">⚠️</span>
                            <span>تباعد ${cvd.divergence.type === 'bullish' ? 'إيجابي' : 'سلبي'}</span>
                            <span class="strength">(قوة: ${cvd.divergence.strength.toFixed(1)})</span>
                        </div>
                    ` : ''}
                    
                    <div class="cvd-details">
                        <small>الزخم: ${cvd.momentum.toFixed(3)} | القوة: ${cvd.strength}/100</small>
                        <small>مصدر البيانات: ${cvd.dataSource === 'trades' ? 'صفقات مباشرة' : 'شموع'}</small>
                    </div>
                </div>
                
                <div class="technical-indicators">
                    <div class="indicator">RSI: ${coin.technicalIndicators.rsi.toFixed(1)}</div>
                    <div class="indicator">MFI: ${coin.technicalIndicators.mfi.toFixed(1)}</div>
                    <div class="indicator">MACD: ${coin.technicalIndicators.macd > 0 ? '+' : ''}${coin.technicalIndicators.macd.toFixed(3)}</div>
                </div>
                
                <div class="score-section">
                    <div class="score">${coin.score}/100</div>
                    <div class="conditions">${coin.achievedConditionsCount}/13 شروط</div>
                    <div class="cvd-contribution">CVD: ${this.countCVDConditions(coin.conditions)}/7</div>
                </div>
                
                <div class="targets-section">
                    <h5>الأهداف (فيبوناتشي):</h5>
                    <div class="targets">
                        <span class="target">T1: ${coin.technicalIndicators.fibonacci.level236.toFixed(6)}</span>
                        <span class="target">T2: ${coin.technicalIndicators.fibonacci.level382.toFixed(6)}</span>
                        <span class="target">T3: ${coin.technicalIndicators.fibonacci.level500.toFixed(6)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// دوال مساعدة للعرض
getCVDTrendClass(trend) {
    const classes = {
        'very_bullish': 'very-positive',
        'bullish': 'positive',
        'weak_bullish': 'weak-positive',
        'neutral': 'neutral',
        'weak_bearish': 'weak-negative',
        'bearish': 'negative',
        'very_bearish': 'very-negative'
    };
    return classes[trend] || 'neutral';
}

getCVDSignalClass(signal) {
    const classes = {
        'strong_buy': 'strong-buy',
        'buy': 'buy',
        'weak_buy': 'weak-buy',
        'hold': 'hold',
        'weak_sell': 'weak-sell',
        'sell': 'sell',
        'strong_sell': 'strong-sell'
    };
    return classes[signal] || 'hold';
}

translateCVDSignal(signal) {
    const translations = {
        'strong_buy': 'شراء قوي',
        'buy': 'شراء',
        'weak_buy': 'شراء ضعيف',
        'hold': 'انتظار',
        'weak_sell': 'بيع ضعيف',
        'sell': 'بيع',
        'strong_sell': 'بيع قوي'
    };
    return translations[signal] || 'غير محدد';
}

translateCVDTrend(trend) {
    const translations = {
        'very_bullish': 'صاعد جداً',
        'bullish': 'صاعد',
        'weak_bullish': 'صاعد ضعيف',
        'neutral': 'محايد',
        'weak_bearish': 'هابط ضعيف',
        'bearish': 'هابط',
        'very_bearish': 'هابط جداً'
    };
    return translations[trend] || 'غير محدد';
}

countCVDConditions(conditions) {
    const cvdConditions = [
        'cvdStrongBuy',
        'cvdBuyDominance', 
        'cvdPositiveMomentum',
        'cvdBullishDivergence',
        'cvdHighQuality',
        'cvdStrongTrend',
        'cvdVolumeConfirmation'
    ];
    
    return cvdConditions.filter(condition => conditions[condition]).length;
}

// تحديث دالة analyzeCoins لتكون متزامنة
async analyzeCoins() {
    console.log('🔍 بدء تحليل العملات مع CVD الأصلي...');

    // حساب النقاط لكل عملة
    for (const coin of this.coins) {
        await this.calculateScore(coin);
    }

    // ترتيب العملات حسب الشروط ثم التغيير
    this.coins.sort((a, b) => {
        // أولاً: عدد الشروط
        if (a.achievedConditionsCount !== b.achievedConditionsCount) {
            return b.achievedConditionsCount - a.achievedConditionsCount;
        }
        
        // ثانياً: قوة CVD
        const aCvdScore = a.technicalIndicators.cvd.strength + a.technicalIndicators.cvd.confidence;
        const bCvdScore = b.technicalIndicators.cvd.strength + b.technicalIndicators.cvd.confidence;
        if (Math.abs(aCvdScore - bCvdScore) > 10) {
            return bCvdScore - aCvdScore;
        }
        
        // ثالثاً: التغيير السعري
        return b.change24h - a.change24h;
    });

    // تطبيق نظام الترتيب والخصم
    for (let i = 0; i < this.coins.length; i++) {
        const coin = this.coins[i];
        coin.rank = i + 1;

        if (i === 0) {
            coin.finalScore = coin.baseScore;
        } else {
            const previousCoin = this.coins[i - 1];
            const deduction = Math.min(coin.rank * 2, 20); // خصم أقصى 20 نقطة
            coin.finalScore = Math.max(previousCoin.finalScore - deduction, 0);
        }

        coin.score = coin.finalScore;
    }

    console.log('🏆 الترتيب النهائي مع CVD:');
    this.coins.slice(0, 10).forEach(coin => {
        const cvd = coin.technicalIndicators.cvd;
        console.log(`${coin.rank}. ${coin.symbol}:`);
        console.log(`   📊 الشروط: ${coin.achievedConditionsCount}/13 | النقاط: ${coin.score}`);
        console.log(`   📈 التغيير: ${coin.change24h.toFixed(2)}%`);
        console.log(`   🔄 CVD: ${cvd.value.toFixed(2)}% | ${cvd.trend} | ${cvd.signal}`);
        console.log(`   💪 قوة CVD: ${cvd.strength}/100 | ثقة: ${cvd.confidence}%`);
        console.log(`   📊 ضغط الشراء: ${cvd.buyPressure.toFixed(1)}%`);
        console.log(`   ✅ شروط CVD: ${this.countCVDConditions(coin.conditions)}/7`);
        console.log('   ─────────────────────────────');
    });
}

// تحديث دالة fetchData لتكون متزامنة مع CVD
async fetchData() {
    try {
        console.log('🚀 بدء عملية جلب البيانات مع CVD الأصلي...');

        const candidateSymbols = await this.fetchTopGainers();

        if (!candidateSymbols || candidateSymbols.length === 0) {
            throw new Error('لم يتم العثور على عملات مرشحة');
        }

        console.log(`📋 سيتم تحليل ${candidateSymbols.length} عملة مع CVD`);

        const results = [];

        for (let i = 0; i < candidateSymbols.length; i++) {
            const symbol = candidateSymbols[i];

            try {
                console.log(`🔄 تحليل ${symbol} مع CVD... (${i + 1}/${candidateSymbols.length})`);

                const coin = await this.fetchCoinData(symbol);

                if (coin && typeof coin.change24h === 'number' && !isNaN(coin.change24h)) {
                    results.push(coin);
                    const cvd = coin.technicalIndicators.cvd;
                    console.log(`✅ ${symbol}: ${coin.change24h.toFixed(2)}% | CVD: ${cvd.value.toFixed(2)}% (${cvd.trend})`);
                } else {
                    console.warn(`⚠️ بيانات غير صالحة لـ ${symbol}`);
                }

                // تأخير بين الطلبات لتجنب حد المعدل
                if (i < candidateSymbols.length - 1) {
                    await this.delay(this.requestDelay);
                }

            } catch (error) {
                console.warn(`❌ فشل في تحليل ${symbol}:`, error.message);
                continue;
            }
        }

        if (results.length === 0) {
            throw new Error('فشل في الحصول على بيانات صالحة لأي عملة');
        }

        this.coins = results;
        console.log(`🎉 تم تحليل ${this.coins.length} عملة بنجاح مع CVD الأصلي`);

    } catch (error) {
        console.error('💥 خطأ في fetchData:', error);
        this.showError(`خطأ في جلب البيانات: ${error.message}`);
        throw error;
    }
}

// تحديث دالة init لتكون متزامنة
async init() {
    this.showLoading();
    try {
        await this.fetchData();
        await this.analyzeCoins();
        this.renderCoins();
        console.log('🎯 تم الانتهاء من التحليل الكامل مع CVD الأصلي');
    } catch (error) {
        console.error('❌ فشل في التهيئة:', error);
        this.showError('فشل في تحليل البيانات. يرجى المحاولة مرة أخرى.');
    }
}


// تهيئة التطبيق مع إضافة الأنماط
document.addEventListener('DOMContentLoaded', function() {
    const app = new YaserCrypto();
    app.addCVDStyles();
});
