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
    try {
        await this.fetchData();
        this.analyzeCoins();
        this.renderCoins();
        
        // بدء التحديثات في الوقت الفعلي
        this.startRealTimeUpdates();
        
        console.log('✅ تم تشغيل النظام بنجاح مع CVD والتحديثات المباشرة');
    } catch (error) {
        console.error('❌ فشل في تشغيل النظام:', error);
        this.showError(`فشل في التشغيل: ${error.message}`);
    }
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
        // جلب بيانات السعر الحالي
        const tickerResponse = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT`);
        const tickerData = await tickerResponse.json();
        
        // جلب البيانات التاريخية مع حجم التداول
        const candlesResponse = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT&bar=1H&limit=168`); // 7 أيام بالساعة
        const candlesData = await candlesResponse.json();
        
        // جلب بيانات Order Book للحصول على بيانات الشراء/البيع
        const orderbookResponse = await fetch(`https://www.okx.com/api/v5/market/books?instId=${symbol}-USDT&sz=20`);
        const orderbookData = await orderbookResponse.json();
        
        if (!tickerData.data || !candlesData.data) {
            throw new Error(`لا توجد بيانات لـ ${symbol}`);
        }
        
        const ticker = tickerData.data[0];
        const historicalData = this.processHistoricalDataWithVolume(candlesData.data);
        const orderbook = orderbookData.data?.[0] || null;
        
        const coin = {
            symbol: symbol,
            name: symbol,
            price: parseFloat(ticker.last),
            change24h: parseFloat(ticker.changePercent),
            volume: parseFloat(ticker.vol24h),
            high24h: parseFloat(ticker.high24h),
            low24h: parseFloat(ticker.low24h),
            historicalData: historicalData,
            orderbook: orderbook,
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
processHistoricalDataWithVolume(candlesData) {
    return candlesData.map(candle => ({
        timestamp: parseInt(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        volumeCurrency: parseFloat(candle[6]) || 0, // حجم بالعملة الأساسية
        volumeCurrencyQuote: parseFloat(candle[7]) || 0, // حجم بعملة التسعير
        confirm: candle[8] === "1" // تأكيد إغلاق الشمعة
    })).reverse();
}
calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) {
        return 50; // قيمة افتراضية
    }
    
    let gains = 0;
    let losses = 0;
    
    // حساب المتوسط الأولي
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // حساب RSI للفترات المتبقية
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;
        
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    }
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

calculateEMA(closes, period) {
    if (closes.length === 0) return 0;
    if (closes.length < period) return closes[closes.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = closes[0];
    
    for (let i = 1; i < closes.length; i++) {
        ema = (closes[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
}

calculateMFI(highs, lows, closes, volumes, period = 14) {
    if (closes.length < period + 1) {
        return 50; // قيمة افتراضية
    }
    
    const typicalPrices = [];
    const moneyFlows = [];
    
    for (let i = 0; i < closes.length; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        typicalPrices.push(typicalPrice);
        
        if (i > 0) {
            const moneyFlow = typicalPrice * volumes[i];
            moneyFlows.push({
                value: moneyFlow,
                isPositive: typicalPrice > typicalPrices[i - 1]
            });
        }
    }
    
    if (moneyFlows.length < period) return 50;
    
    const recentFlows = moneyFlows.slice(-period);
    const positiveFlow = recentFlows
        .filter(flow => flow.isPositive)
        .reduce((sum, flow) => sum + flow.value, 0);
    
    const negativeFlow = recentFlows
        .filter(flow => !flow.isPositive)
        .reduce((sum, flow) => sum + flow.value, 0);
    
    if (negativeFlow === 0) return 100;
    
    const moneyRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyRatio));
}

calculateBollingerBands(closes, period = 20, multiplier = 2) {
    if (closes.length < period) {
        const currentPrice = closes[closes.length - 1] || 0;
        return {
            upper: currentPrice * 1.02,
            middle: currentPrice,
            lower: currentPrice * 0.98
        };
    }
    
    const recentCloses = closes.slice(-period);
    const sma = recentCloses.reduce((sum, price) => sum + price, 0) / period;
    
    const variance = recentCloses.reduce((sum, price) => {
        return sum + Math.pow(price - sma, 2);
    }, 0) / period;
    
    const standardDeviation = Math.sqrt(variance);
    
    return {
        upper: sma + (standardDeviation * multiplier),
        middle: sma,
        lower: sma - (standardDeviation * multiplier)
    };
}

calculateStochastic(highs, lows, closes, period = 14) {
    if (closes.length < period) {
        return { k: 50, d: 50 };
    }
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // حساب %D (متوسط متحرك بسيط لـ %K)
    const kValues = [];
    for (let i = Math.max(0, closes.length - 3); i < closes.length; i++) {
        const periodHighs = highs.slice(Math.max(0, i - period + 1), i + 1);
        const periodLows = lows.slice(Math.max(0, i - period + 1), i + 1);
        const periodHigh = Math.max(...periodHighs);
        const periodLow = Math.min(...periodLows);
        
        if (periodHigh !== periodLow) {
            kValues.push(((closes[i] - periodLow) / (periodHigh - periodLow)) * 100);
        }
    }
    
    const d = kValues.length > 0 ? kValues.reduce((sum, val) => sum + val, 0) / kValues.length : 50;
    
    return { k: k || 50, d: d || 50 };
}

calculateMACD(closes) {
    if (closes.length < 26) {
        return { macd: 0, signal: 0, histogram: 0 };
    }
    
    const ema12 = this.calculateEMAArray(closes, 12);
    const ema26 = this.calculateEMAArray(closes, 26);
    
    const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
    
    // حساب Signal line (EMA 9 من MACD)
    const macdValues = [];
    for (let i = 25; i < closes.length; i++) {
        const ema12Val = this.calculateEMAArray(closes.slice(0, i + 1), 12);
        const ema26Val = this.calculateEMAArray(closes.slice(0, i + 1), 26);
        macdValues.push(ema12Val[ema12Val.length - 1] - ema26Val[ema26Val.length - 1]);
    }
    
    const signalLine = macdValues.length >= 9 ? 
        this.calculateEMAArray(macdValues, 9)[macdValues.length - 1] : 0;
    
    return {
        macd: macdLine,
        signal: signalLine,
        histogram: macdLine - signalLine
    };
}

calculateEMAArray(data, period) {
    if (data.length === 0) return [];
    
    const multiplier = 2 / (period + 1);
    const emaArray = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
        const ema = (data[i] * multiplier) + (emaArray[i - 1] * (1 - multiplier));
        emaArray.push(ema);
    }
    
    return emaArray;
}
calculateFibonacci(highs, lows) {
    if (!highs || !lows || highs.length === 0 || lows.length === 0) {
        const defaultPrice = 1;
        return {
            level0: defaultPrice,
            level236: defaultPrice * 1.236,
            level382: defaultPrice * 1.382,
            level500: defaultPrice * 1.500,
            level618: defaultPrice * 1.618,
            level786: defaultPrice * 0.786,
            level1000: defaultPrice * 0.5
        };
    }
    
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const diff = high - low;
    
    if (diff === 0) {
        return {
            level0: high,
            level236: high,
            level382: high,
            level500: high,
            level618: high,
            level786: high,
            level1000: high
        };
    }
    
    // للاتجاه الصاعد - الأهداف أعلى من السعر الحالي
    return {
        level0: high, // 0% = السعر الحالي
        level236: high + (diff * 0.236), // هدف 1
        level382: high + (diff * 0.382), // هدف 2
        level500: high + (diff * 0.500), // هدف 3
        level618: high + (diff * 0.618), // هدف 4
        level786: low + (diff * 0.214), // دعم قوي
        level1000: low // 100% = أقل سعر
    };
}


   calculateTechnicalIndicators(coin) {
    const historicalData = coin.historicalData;
    const closes = historicalData.map(d => d.close);
    const highs = historicalData.map(d => d.high);
    const lows = historicalData.map(d => d.low);
    const volumes = historicalData.map(d => d.volume);
    const opens = historicalData.map(d => d.open);
    
    // المؤشرات الموجودة...
    coin.technicalIndicators.rsi = this.calculateRSI(closes, 14);
    coin.technicalIndicators.ema20 = this.calculateEMA(closes, 20);
    coin.technicalIndicators.ema50 = this.calculateEMA(closes, 50);
    
    const macdData = this.calculateMACD(closes);
    coin.technicalIndicators.macd = macdData.macd;
    coin.technicalIndicators.macdSignal = macdData.signal;
    coin.technicalIndicators.macdHistogram = macdData.histogram;
    
    coin.technicalIndicators.mfi = this.calculateMFI(highs, lows, closes, volumes, 14);
    coin.technicalIndicators.fibonacci = this.calculateFibonacci(highs, lows);
    coin.technicalIndicators.bollingerBands = this.calculateBollingerBands(closes, 20, 2);
    coin.technicalIndicators.stochastic = this.calculateStochastic(highs, lows, closes, 14);
    
    // إضافة CVD الجديد
    coin.technicalIndicators.cvd = this.calculateCVD(opens, closes, highs, lows, volumes);
    
    // إضافة مؤشرات حجم إضافية
    coin.technicalIndicators.volumeProfile = this.calculateVolumeProfile(closes, volumes);
    coin.technicalIndicators.vwap = this.calculateVWAP(highs, lows, closes, volumes);
    
    // تحليل Order Book إذا كان متوفراً
    if (coin.orderbook) {
        coin.technicalIndicators.orderBookAnalysis = this.analyzeOrderBook(coin.orderbook, coin.price);
    }
}
calculateCVD(opens, closes, highs, lows, volumes, period = 20) {
    if (volumes.length < 2) return { cvd: 0, trend: 'neutral', strength: 0 };
    
    const volumeDeltas = [];
    let cumulativeDelta = 0;
    
    for (let i = 0; i < volumes.length; i++) {
        const open = opens[i];
        const close = closes[i];
        const high = highs[i];
        const low = lows[i];
        const volume = volumes[i];
        
        // حساب Volume Delta لكل شمعة
        let volumeDelta;
        
        if (close > open) {
            // شمعة خضراء - معظم الحجم شراء
            const bodyRatio = (close - open) / (high - low);
            volumeDelta = volume * (0.5 + (bodyRatio * 0.5)); // 50-100% شراء
        } else if (close < open) {
            // شمعة حمراء - معظم الحجم بيع
            const bodyRatio = (open - close) / (high - low);
            volumeDelta = -volume * (0.5 + (bodyRatio * 0.5)); // 50-100% بيع
        } else {
            // شمعة دوجي - حجم متوازن
            volumeDelta = 0;
        }
        
        cumulativeDelta += volumeDelta;
        volumeDeltas.push({
            delta: volumeDelta,
            cumulative: cumulativeDelta,
            timestamp: i
        });
    }
    
    // تحليل الاتجاه
    const recentDeltas = volumeDeltas.slice(-period);
    const avgDelta = recentDeltas.reduce((sum, d) => sum + d.delta, 0) / period;
    const currentCVD = cumulativeDelta;
    const previousCVD = volumeDeltas[volumeDeltas.length - period]?.cumulative || 0;
    const cvdChange = currentCVD - previousCVD;
    
    // تحديد قوة الاتجاه
    let trend = 'neutral';
    let strength = 0;
    
    if (cvdChange > 0) {
        trend = 'bullish';
        strength = Math.min((cvdChange / Math.abs(previousCVD || 1)) * 100, 100);
    } else if (cvdChange < 0) {
        trend = 'bearish';
        strength = Math.min((Math.abs(cvdChange) / Math.abs(previousCVD || 1)) * 100, 100);
    }
    
    // تحليل التباعد (Divergence)
    const priceChange = closes[closes.length - 1] - closes[closes.length - period];
    const divergence = this.detectCVDDivergence(closes.slice(-period), recentDeltas.map(d => d.cumulative));
    
    return {
        cvd: currentCVD,
        cvdChange: cvdChange,
        trend: trend,
        strength: Math.abs(strength),
        avgDelta: avgDelta,
        divergence: divergence,
        volumeDeltas: volumeDeltas.slice(-50), // آخر 50 قيمة للرسم البياني
        bullishVolume: recentDeltas.filter(d => d.delta > 0).reduce((sum, d) => sum + d.delta, 0),
        bearishVolume: Math.abs(recentDeltas.filter(d => d.delta < 0).reduce((sum, d) => sum + d.delta, 0))
    };
}
detectCVDDivergence(prices, cvdValues) {
    if (prices.length < 10 || cvdValues.length < 10) {
        return { type: 'none', strength: 0 };
    }
    
    const priceStart = prices[0];
    const priceEnd = prices[prices.length - 1];
    const cvdStart = cvdValues[0];
    const cvdEnd = cvdValues[cvdValues.length - 1];
    
    const priceDirection = priceEnd > priceStart ? 'up' : 'down';
    const cvdDirection = cvdEnd > cvdStart ? 'up' : 'down';
    
    // كشف التباعد
    if (priceDirection === 'up' && cvdDirection === 'down') {
        return {
            type: 'bearish_divergence',
            strength: Math.abs((priceEnd - priceStart) / priceStart) * 100,
            description: 'السعر يرتفع لكن CVD ينخفض - إشارة هبوط محتملة'
        };
    } else if (priceDirection === 'down' && cvdDirection === 'up') {
        return {
            type: 'bullish_divergence',
            strength: Math.abs((priceEnd - priceStart) / priceStart) * 100,
            description: 'السعر ينخفض لكن CVD يرتفع - إشارة صعود محتملة'
        };
    }
    
    return { type: 'none', strength: 0 };
}
calculateVWAP(highs, lows, closes, volumes) {
    if (volumes.length === 0) return closes[closes.length - 1];
    
    let totalVolumePrice = 0;
    let totalVolume = 0;
    
    for (let i = 0; i < closes.length; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        totalVolumePrice += typicalPrice * volumes[i];
        totalVolume += volumes[i];
    }
    
    return totalVolume > 0 ? totalVolumePrice / totalVolume : closes[closes.length - 1];
}

calculateVolumeProfile(closes, volumes, bins = 20) {
    if (closes.length === 0) return [];
    
    const minPrice = Math.min(...closes);
    const maxPrice = Math.max(...closes);
    const priceRange = maxPrice - minPrice;
    const binSize = priceRange / bins;
    
    const profile = [];
    
    for (let i = 0; i < bins; i++) {
        const binLow = minPrice + (i * binSize);
        const binHigh = binLow + binSize;
        let binVolume = 0;
        
        for (let j = 0; j < closes.length; j++) {
            if (closes[j] >= binLow && closes[j] < binHigh) {
                binVolume += volumes[j];
            }
        }
        
        profile.push({
            priceLevel: (binLow + binHigh) / 2,
            volume: binVolume,
            percentage: 0 // سيتم حسابها لاحقاً
        });
    }
    
    const totalVolume = profile.reduce((sum, bin) => sum + bin.volume, 0);
    profile.forEach(bin => {
        bin.percentage = totalVolume > 0 ? (bin.volume / totalVolume) * 100 : 0;
    });
    
    return profile.sort((a, b) => b.volume - a.volume);
}
analyzeOrderBook(orderbook, currentPrice) {
    if (!orderbook.bids || !orderbook.asks) {
        return { pressure: 'neutral', ratio: 1, strength: 0 };
    }
    
    const bids = orderbook.bids.map(bid => ({
        price: parseFloat(bid[0]),
        size: parseFloat(bid[1])
    }));
    
    const asks = orderbook.asks.map(ask => ({
        price: parseFloat(ask[0]),
        size: parseFloat(ask[1])
    }));
    
    // حساب إجمالي الطلبات القريبة من السعر (5%)
    const priceRange = currentPrice * 0.05;
    
    const nearBids = bids.filter(bid => 
        bid.price >= currentPrice - priceRange
    ).reduce((sum, bid) => sum + bid.size, 0);
    
    const nearAsks = asks.filter(ask => 
        ask.price <= currentPrice + priceRange
    ).reduce((sum, ask) => sum + ask.size, 0);
    
    const totalNearVolume = nearBids + nearAsks;
    const buyPressure = totalNearVolume > 0 ? (nearBids / totalNearVolume) * 100 : 50;
    
    let pressure = 'neutral';
    if (buyPressure > 60) pressure = 'bullish';
    else if (buyPressure < 40) pressure = 'bearish';
    
    // حساب قوة الجدار (Wall Strength)
    const bidWall = Math.max(...bids.slice(0, 5).map(bid => bid.size));
    const askWall = Math.max(...asks.slice(0, 5).map(ask => ask.size));
    
    return {
        pressure: pressure,
        buyPressure: buyPressure,
        sellPressure: 100 - buyPressure,
        ratio: nearAsks > 0 ? nearBids / nearAsks : 10,
        strength: Math.abs(buyPressure - 50),
        bidWall: bidWall,
        askWall: askWall,
        wallRatio: askWall > 0 ? bidWall / askWall : 10,
        nearBidsVolume: nearBids,
        nearAsksVolume: nearAsks
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
    const bb = coin.technicalIndicators.bollingerBands;
    const stoch = coin.technicalIndicators.stochastic;
    const cvd = coin.technicalIndicators.cvd;
    const vwap = coin.technicalIndicators.vwap;
    const orderBook = coin.technicalIndicators.orderBookAnalysis;
    
    // الشروط الأساسية الموجودة
    if (changePercent >= 3) conditions.rise3Percent = true;
    if (changePercent >= 4) conditions.rise4Percent = true;
    if (currentPrice >= ema20 && currentPrice >= ema50) conditions.breakoutMA = true;
    if (rsi > 50 && rsi < 70) conditions.rsiBullish = true;
    if (macd > macdSignal) conditions.macdBullish = true;
    if (mfi > 50 && mfi < 80) conditions.mfiBullish = true;
    if (currentPrice > bb.middle) conditions.aboveBBMiddle = true;
    if (stoch.k > 20 && stoch.k < 80) conditions.stochHealthy = true;
    if (ema20 > ema50) conditions.trendBullish = true;
    
    // شروط CVD الجديدة
    if (cvd && cvd.trend === 'bullish' && cvd.strength > 30) {
        conditions.cvdBullish = true;
    }
    
    if (cvd && cvd.bullishVolume > cvd.bearishVolume * 1.5) {
        conditions.volumeBuyPressure = true;
    }
    
    if (cvd && cvd.divergence.type === 'bullish_divergence') {
        conditions.bullishDivergence = true;
    }
    
    // شروط VWAP
    if (vwap && currentPrice > vwap) {
        conditions.aboveVWAP = true;
    }
    
    // شروط Order Book
    if (orderBook && orderBook.pressure === 'bullish' && orderBook.buyPressure > 65) {
        conditions.orderBookBullish = true;
    }
    
    if (orderBook && orderBook.wallRatio > 1.5) {
        conditions.bidWallSupport = true;
    }
    
    // شرط التأكيد المتعدد (عندما تتفق عدة مؤشرات حجم)
    const volumeIndicators = [
        conditions.cvdBullish,
        conditions.volumeBuyPressure,
        conditions.aboveVWAP,
        conditions.orderBookBullish
    ].filter(Boolean).length;
    
    if (volumeIndicators >= 3) {
        conditions.volumeConfirmation = true;
    }
    
    // حساب النقاط مع الأوزان الجديدة
    const achievedConditions = Object.keys(conditions).length;
    let baseScore = 0;
    
    // نقاط أساسية
    baseScore += achievedConditions * 8;
    
    // نقاط إضافية للمؤشرات المهمة
    if (conditions.cvdBullish) baseScore += 15;
    if (conditions.volumeConfirmation) baseScore += 20;
    if (conditions.bullishDivergence) baseScore += 25;
    if (conditions.orderBookBullish) baseScore += 10;
    if (conditions.bidWallSupport) baseScore += 10;
    
    // حد أقصى 100
    baseScore = Math.min(baseScore, 100);
    
    coin.baseScore = baseScore;
    coin.score = baseScore;
    coin.conditions = conditions;
    coin.achievedConditionsCount = achievedConditions;
    
    // تسجيل تفصيلي
    console.log(`📊 ${coin.symbol}: الشروط=${achievedConditions}, النقاط=${baseScore}`);
    console.log(`   CVD: ${cvd?.trend || 'N/A'} (${cvd?.strength?.toFixed(1) || 0}%)`);
    console.log(`   حجم الشراء: ${cvd?.bullishVolume?.toFixed(0) || 0} vs بيع: ${cvd?.bearishVolume?.toFixed(0) || 0}`);
    console.log(`   Order Book: ${orderBook?.pressure || 'N/A'} (${orderBook?.buyPressure?.toFixed(1) || 0}%)`);
    if (cvd?.divergence?.type !== 'none') {
        console.log(`   🔄 تباعد: ${cvd.divergence.description}`);
    }
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

    renderCoinCard(coin, index) {
    const cvd = coin.technicalIndicators.cvd;
    const orderBook = coin.technicalIndicators.orderBookAnalysis;
    const vwap = coin.technicalIndicators.vwap;
    
    // رموز الحالة
    const getCVDIcon = (trend, strength) => {
        if (trend === 'bullish' && strength > 50) return '🟢📈';
        if (trend === 'bullish' && strength > 20) return '🟡📈';
        if (trend === 'bearish' && strength > 50) return '🔴📉';
        if (trend === 'bearish' && strength > 20) return '🟡📉';
        return '⚪➡️';
    };
    
    const getOrderBookIcon = (pressure, buyPressure) => {
        if (pressure === 'bullish' && buyPressure > 70) return '🟢🏛️';
        if (pressure === 'bullish') return '🟡🏛️';
        if (pressure === 'bearish') return '🔴🏛️';
        return '⚪🏛️';
    };
    
    return `
        <div class="coin-card ${coin.score >= 80 ? 'high-score' : coin.score >= 60 ? 'medium-score' : 'low-score'}">
            <div class="coin-header">
                <h3>${coin.symbol}</h3>
                <div class="score-badge">${coin.score}</div>
            </div>
            
            <div class="price-info">
                <div class="current-price">$${coin.price.toFixed(6)}</div>
                <div class="change-24h ${coin.change24h >= 0 ? 'positive' : 'negative'}">
                    ${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%
                </div>
            </div>
            
            <div class="indicators-grid">
                <div class="indicator">
                    <span class="label">RSI:</span>
                    <span class="value ${coin.technicalIndicators.rsi > 70 ? 'overbought' : coin.technicalIndicators.rsi < 30 ? 'oversold' : 'neutral'}">
                        ${coin.technicalIndicators.rsi.toFixed(1)}
                    </span>
                </div>
                
                <div class="indicator">
                    <span class="label">MFI:</span>
                    <span class="value">${coin.technicalIndicators.mfi.toFixed(1)}</span>
                </div>
                
                <div class="indicator cvd-indicator">
                    <span class="label">CVD:</span>
                    <span class="value">
                        ${getCVDIcon(cvd?.trend, cvd?.strength)} ${cvd?.strength?.toFixed(1) || 0}%
                    </span>
                </div>
                
                <div class="indicator">
                    <span class="label">VWAP:</span>
                    <span class="value ${coin.price > vwap ? 'above-vwap' : 'below-vwap'}">
                        ${coin.price > vwap ? '🟢' : '🔴'} $${vwap?.toFixed(6) || 0}
                    </span>
                </div>
                
                <div class="indicator orderbook-indicator">
                    <span class="label">Order Book:</span>
                    <span class="value">
                        ${getOrderBookIcon(orderBook?.pressure, orderBook?.buyPressure)} 
                        ${orderBook?.buyPressure?.toFixed(1) || 50}%
                    </span>
                </div>
            </div>
            
            ${cvd?.divergence?.type !== 'none' ? `
                <div class="divergence-alert ${cvd.divergence.type}">
                    <strong>⚠️ تباعد:</strong> ${cvd.divergence.description}
                </div>
            ` : ''}
            
            <div class="volume-analysis">
                <div class="volume-bar">
                    <div class="buy-volume" style="width: ${(cvd?.bullishVolume || 0) / ((cvd?.bullishVolume || 0) + (cvd?.bearishVolume || 1)) * 100}%"></div>
                    <div class="sell-volume" style="width: ${(cvd?.bearishVolume || 0) / ((cvd?.bullishVolume || 1) + (cvd?.bearishVolume || 0)) * 100}%"></div>
                </div>
                <div class="volume-labels">
                    <span class="buy-label">شراء: ${((cvd?.bullishVolume || 0) / 1000).toFixed(1)}K</span>
                    <span class="sell-label">بيع: ${((cvd?.bearishVolume || 0) / 1000).toFixed(1)}K</span>
                </div>
            </div>
            
            <div class="targets">
                <div class="target">دخول: $${coin.targets?.entry?.toFixed(6) || coin.price.toFixed(6)}</div>
                <div class="target">هدف 1: $${coin.targets?.target1?.toFixed(6) || 0}</div>
                <div class="target">هدف 2: $${coin.targets?.target2?.toFixed(6) || 0}</div>
                <div class="target stop-loss">وقف خسارة: $${coin.targets?.stopLoss?.toFixed(6) || 0}</div>
            </div>
            
            <div class="conditions-summary">
                الشروط المحققة: ${coin.achievedConditionsCount} / ${Object.keys(coin.conditions).length + 6}
            </div>
        </div>
    `;
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
