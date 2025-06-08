class YaserCrypto {
    constructor() {
        this.coins = [];
        this.config = {
            okxApiUrl: "https://www.okx.com/api/v5",
            binanceApiUrl: "https://api.binance.com/api/v3",
            requestDelay: 500,
            maxCoins: 50,
            minChange: 1,
            maxChange: 15,
            minVolume: 100000,
            dataSources: ['okx', 'binance']
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
            console.log('🚀 بدء عملية جلب البيانات من مصادر متعددة...');
            
            // جلب البيانات من كلا المصدرين بشكل متوازي
            const [okxSymbols, binanceSymbols] = await Promise.allSettled([
                this.fetchTopGainersFromOKX(),
                this.fetchTopGainersFromBinance()
            ]);

            let candidateSymbols = [];
            
            // دمج النتائج من OKX
            if (okxSymbols.status === 'fulfilled' && okxSymbols.value) {
                console.log(`📊 OKX: ${okxSymbols.value.length} عملة`);
                candidateSymbols = candidateSymbols.concat(
                    okxSymbols.value.map(symbol => ({ symbol, source: 'okx' }))
                );
            } else {
                console.warn('⚠️ فشل في جلب البيانات من OKX:', okxSymbols.reason);
            }

            // دمج النتائج من Binance
            if (binanceSymbols.status === 'fulfilled' && binanceSymbols.value) {
                console.log(`📊 Binance: ${binanceSymbols.value.length} عملة`);
                candidateSymbols = candidateSymbols.concat(
                    binanceSymbols.value.map(symbol => ({ symbol, source: 'binance' }))
                );
            } else {
                console.warn('⚠️ فشل في جلب البيانات من Binance:', binanceSymbols.reason);
            }

            if (candidateSymbols.length === 0) {
                throw new Error('لم يتم العثور على عملات مرشحة من أي مصدر');
            }

            // إزالة التكرارات وإعطاء أولوية للعملات الموجودة في كلا المصدرين
            const uniqueSymbols = this.mergeDuplicateSymbols(candidateSymbols);
            console.log(`📋 سيتم تحليل ${uniqueSymbols.length} عملة فريدة`);

            const results = [];
            for (let i = 0; i < uniqueSymbols.length; i++) {
                const { symbol, source, priority } = uniqueSymbols[i];
                
                try {
                    console.log(`🔄 تحليل ${symbol} من ${source}... (${i + 1}/${uniqueSymbols.length})`);
                    
                    const coin = await this.fetchCoinData(symbol, source);
                    if (coin && typeof coin.change24h === 'number' && !isNaN(coin.change24h)) {
                        coin.priority = priority;
                        coin.dataSource = source;
                        results.push(coin);
                        console.log(`✅ ${symbol}: ${coin.change24h.toFixed(2)}% (${source})`);
                    } else {
                        console.warn(`⚠️ بيانات غير صالحة لـ ${symbol}`);
                    }

                    if (i < uniqueSymbols.length - 1) {
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

            // ترتيب النتائج حسب الأولوية ثم التغيير
            this.coins = results.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority;
                }
                return b.change24h - a.change24h;
            });

            console.log(`🎉 تم تحليل ${this.coins.length} عملة بنجاح`);

        } catch (error) {
            console.error('💥 خطأ في fetchData:', error);
            this.showError(`خطأ في جلب البيانات: ${error.message}`);
            throw error;
        }
    }

    // دالة دمج الرموز المكررة
    mergeDuplicateSymbols(candidateSymbols) {
        const symbolMap = new Map();
        
        candidateSymbols.forEach(({ symbol, source }) => {
            if (symbolMap.has(symbol)) {
                symbolMap.get(symbol).priority = 3; // أولوية عالية للعملات في كلا المصدرين
                symbolMap.get(symbol).sources.push(source);
            } else {
                symbolMap.set(symbol, {
                    symbol,
                    source,
                    sources: [source],
                    priority: 1
                });
            }
        });

        return Array.from(symbolMap.values()).slice(0, this.config.maxCoins);
    }

    async fetchTopGainersFromOKX() {
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
            console.log('📡 استلام البيانات من OKX API:', data.data ? data.data.length : 0, 'عملة');

            if (!data.data || data.data.length === 0) {
                throw new Error('لا توجد بيانات من OKX API');
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
                .slice(0, 12); // أخذ أفضل 12 عملة

            console.log(`🎯 OKX: تم العثور على ${usdtPairs.length} عملة مرشحة`);

            if (usdtPairs.length === 0) {
                throw new Error('لم يتم العثور على عملات تحقق المعايير في OKX');
            }

            // عرض أفضل 5 عملات للتحقق
            console.log('🏆 أفضل 5 عملات مرشحة من OKX:');
            usdtPairs.slice(0, 5).forEach((coin, index) => {
                console.log(`${index + 1}. ${coin.symbol}: +${coin.change24h.toFixed(2)}% - الحجم: ${coin.volume.toLocaleString()}`);
            });

            return usdtPairs.map(coin => coin.symbol);

        } catch (error) {
            console.error('❌ خطأ في fetchTopGainersFromOKX:', error);
            throw error;
        }
    }

    async fetchTopGainersFromBinance() {
        try {
            console.log('جاري جلب قائمة أعلى الرابحون من Binance...');

            const response = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`فشل في جلب البيانات من Binance: ${response.status}`);
            }

            const data = await response.json();
            console.log('📡 استلام البيانات من Binance API:', Array.isArray(data) ? data.length : 0, 'عملة');

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('لا توجد بيانات من Binance API');
            }

            // فلترة العملات مع نفس المعايير
            const usdtPairs = data
                .filter(ticker => {
                    if (!ticker.symbol || !ticker.symbol.endsWith('USDT')) {
                        return false;
                    }

                    const change24h = parseFloat(ticker.priceChangePercent);
                    const volume = parseFloat(ticker.quoteVolume);
                    const price = parseFloat(ticker.lastPrice);

                    // التحقق من صحة البيانات
                    if (isNaN(change24h) || isNaN(volume) || isNaN(price) || price <= 0) {
                        return false;
                    }

                    // نفس المعايير المستخدمة في OKX
                    const validChange = change24h > 0.5 && change24h < 25;
                    const validVolume = volume > 10000;

                    return validChange && validVolume;
                })
                .map(ticker => ({
                    symbol: ticker.symbol.replace('USDT', ''),
                    change24h: parseFloat(ticker.priceChangePercent),
                    volume: parseFloat(ticker.quoteVolume),
                    price: parseFloat(ticker.lastPrice)
                }))
                .sort((a, b) => b.change24h - a.change24h)
                .slice(0, 12);

            console.log(`🎯 Binance: تم العثور على ${usdtPairs.length} عملة مرشحة`);

            if (usdtPairs.length === 0) {
                throw new Error('لم يتم العثور على عملات تحقق المعايير في Binance');
            }

            // عرض أفضل 5 عملات للتحقق
            console.log('🏆 أفضل 5 عملات مرشحة من Binance:');
            usdtPairs.slice(0, 5).forEach((coin, index) => {
                console.log(`${index + 1}. ${coin.symbol}: +${coin.change24h.toFixed(2)}% - الحجم: ${coin.volume.toLocaleString()}`);
            });

            return usdtPairs.map(coin => coin.symbol);

        } catch (error) {
            console.error('❌ خطأ في fetchTopGainersFromBinance:', error);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchCoinData(symbol, source = 'okx') {
        try {
            if (source === 'binance') {
                return await this.fetchCoinDataFromBinance(symbol);
            } else {
                return await this.fetchCoinDataFromOKX(symbol);
            }
        } catch (error) {
            console.error(`خطأ في جلب بيانات ${symbol} من ${source}:`, error);
            throw error;
        }
    }

    async fetchCoinDataFromOKX(symbol) {
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
                targets: {},
                dataSource: 'okx'
            };

            this.calculateTechnicalIndicators(coin);
            return coin;

        } catch (error) {
            console.error(`خطأ في جلب بيانات ${symbol} من OKX:`, error);
            throw error;
        }
    }

    async fetchCoinDataFromBinance(symbol) {
        try {
            const tickerUrl = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`;
            const klinesUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=100`;

            // جلب بيانات التيكر
            const tickerResponse = await fetch(tickerUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!tickerResponse.ok) {
                throw new Error(`HTTP ${tickerResponse.status}: ${tickerResponse.statusText}`);
            }

            const tickerData = await tickerResponse.json();

            // جلب البيانات التاريخية
            await this.delay(100);
            const klinesResponse = await fetch(klinesUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            let historicalData = [];
            if (klinesResponse.ok) {
                const klinesData = await klinesResponse.json();
                if (Array.isArray(klinesData) && klinesData.length > 0) {
                    historicalData = klinesData.map(kline => ({
                        timestamp: kline[0],
                        open: parseFloat(kline[1]),
                        high: parseFloat(kline[2]),
                        low: parseFloat(kline[3]),
                        close: parseFloat(kline[4]),
                        volume: parseFloat(kline[5]),
                        volumeQuote: parseFloat(kline[7])
                    }));
                }
            }

            const currentPrice = parseFloat(tickerData.lastPrice);
            const change24h = parseFloat(tickerData.priceChangePercent);

            console.log(`📊 ${symbol}: السعر=${currentPrice}, التغيير=${change24h.toFixed(2)}%`);

            const coin = {
                symbol: symbol,
                name: symbol,
                price: currentPrice,
                change24h: change24h,
                volume: parseFloat(tickerData.quoteVolume) || 0,
                high24h: parseFloat(tickerData.highPrice) || currentPrice,
                low24h: parseFloat(tickerData.lowPrice) || currentPrice,
                historicalData: historicalData,
                technicalIndicators: {},
                score: 0,
                rank: 0,
                conditions: {},
                targets: {},
                dataSource: 'binance'
            };

            this.calculateTechnicalIndicators(coin);
            return coin;

        } catch (error) {
            console.error(`خطأ في جلب بيانات ${symbol} من Binance:`, error);
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

        return { macd: macdLine, signal: signalLine };
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

    calculateParabolicSAR(historicalData) {
        if (historicalData.length < 2) {
            return historicalData[0]?.close || 0;
        }

        // تبسيط حساب Parabolic SAR
        const current = historicalData[historicalData.length - 1];
        const previous = historicalData[historicalData.length - 2];
        
        const af = 0.02; // عامل التسارع
        const trend = current.close > previous.close ? 'up' : 'down';
        
        if (trend === 'up') {
            return current.low - (current.high - current.low) * af;
        } else {
            return current.high + (current.high - current.low) * af;
        }
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

    analyzeCoins() {
        console.log('🔍 بدء تحليل العملات...');
        
        this.coins.forEach((coin, index) => {
            coin.rank = index + 1;
            
            // حساب النقاط بناءً على المؤشرات الفنية
            let score = 0;
            const indicators = coin.technicalIndicators;
            
            // نقاط RSI
            if (indicators.rsi >= 30 && indicators.rsi <= 70) {
                score += 20; // RSI في المنطقة المحايدة
            } else if (indicators.rsi < 30) {
                score += 30; // منطقة تشبع بيعي (فرصة شراء)
            }
            
            // نقاط MACD
            if (indicators.macd > indicators.macdSignal) {
                score += 25; // إشارة صاعدة
            }
            
            // نقاط MFI
            if (indicators.mfi >= 20 && indicators.mfi <= 80) {
                score += 15; // تدفق نقدي صحي
            }
            
            // نقاط CVD
            if (indicators.cvd.trend === 'bullish') {
                score += 20;
                if (indicators.cvd.strength === 'strong') {
                    score += 10;
                }
            }
            
            // نقاط التغيير اليومي
            if (coin.change24h > 0) {
                score += Math.min(coin.change24h * 2, 30); // حد أقصى 30 نقطة
            }
            
            // نقاط الأولوية (للعملات الموجودة في كلا المصدرين)
            if (coin.priority === 3) {
                score += 15; // نقاط إضافية للعملات المؤكدة من مصدرين
            }
            
            coin.score = Math.round(score);
            
            // تحديد الشروط
            coin.conditions = {
                rsiGood: indicators.rsi >= 30 && indicators.rsi <= 70,
                macdBullish: indicators.macd > indicators.macdSignal,
                mfiHealthy: indicators.mfi >= 20 && indicators.mfi <= 80,
                cvdBullish: indicators.cvd.trend === 'bullish',
                priceAboveEMA: coin.price > indicators.ema20,
                volumeGood: coin.volume > this.config.minVolume,
                changePositive: coin.change24h > 0,
                multiSource: coin.priority === 3
            };
            
            // حساب أهداف فيبوناتشي
            coin.targets = {
                target1: indicators.fibonacci.level236,
                target2: indicators.fibonacci.level382,
                target3: indicators.fibonacci.level500,
                stopLoss: indicators.parabolicSAR
            };
            
            console.log(`📊 ${coin.symbol}: النقاط=${coin.score}, المصدر=${coin.dataSource}, الأولوية=${coin.priority}`);
        });
        
        // إعادة ترتيب العملات حسب النقاط
        this.coins.sort((a, b) => b.score - a.score);
        
        // تحديث الترتيب
        this.coins.forEach((coin, index) => {
            coin.rank = index + 1;
        });
        
        console.log('✅ تم الانتهاء من تحليل العملات');
        
        // عرض أفضل 5 عملات
        console.log('🏆 أفضل 5 عملات بعد التحليل:');
        this.coins.slice(0, 5).forEach((coin, index) => {
            console.log(`${index + 1}. ${coin.symbol}: ${coin.score} نقطة - ${coin.change24h.toFixed(2)}% (${coin.dataSource})`);
        });
    }

    renderCoins() {
        const coinsGrid = document.getElementById('coinsGrid');
        if (!coinsGrid) {
            console.error('عنصر coinsGrid غير موجود');
            return;
        }

        if (this.coins.length === 0) {
            coinsGrid.innerHTML = '<div class="no-data">لا توجد عملات للعرض</div>';
            return;
        }

        let html = '';
        
        this.coins.forEach(coin => {
            // تحديد أيقونة المركز
            let rankIcon = '';
            let rankClass = '';
            
            if (coin.rank === 1) {
                rankIcon = '🥇';
                rankClass = 'first-place';
            } else if (coin.rank === 2) {
                rankIcon = '🥈';
                rankClass = 'second-place';
            } else if (coin.rank === 3) {
                rankIcon = '🥉';
                rankClass = 'third-place';
            } else {
                rankIcon = `#${coin.rank}`;
                rankClass = 'other-place';
            }

            // تحديد أيقونة المصدر
            const sourceIcon = coin.dataSource === 'binance' ? '🟡' : '🔵';
            const priorityBadge = coin.priority === 3 ? '<span class="multi-source">⭐</span>' : '';
            
            // تحديد لون النقاط
            let scoreClass = '';
            if (coin.score >= 90) scoreClass = 'score-excellent';
            else if (coin.score >= 80) scoreClass = 'score-very-good';
            else if (coin.score >= 70) scoreClass = 'score-good';
            else if (coin.score >= 60) scoreClass = 'score-average';
            else scoreClass = 'score-poor';

            html += `
                <div class="coin-card ${rankClass}" onclick="openModal('${coin.symbol}')">
                    <div class="rank-badge">
                        <span class="rank-icon">${rankIcon}</span>
                    </div>
                    
                    <div class="coin-header">
                        <div class="coin-symbol">
                            ${sourceIcon} ${coin.symbol} ${priorityBadge}
                        </div>
                        <div class="coin-score ${scoreClass}">
                            ${coin.score}
                        </div>
                    </div>
                    
                    <div class="coin-price">
                        $${coin.price.toFixed(6)}
                    </div>
                    
                    <div class="coin-change ${coin.change24h >= 0 ? 'positive' : 'negative'}">
                        ${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%
                    </div>
                    
                    <div class="coin-volume">
                        الحجم: ${this.formatNumber(coin.volume)}
                    </div>
                </div>
            `;
        });
        
        coinsGrid.innerHTML = html;
        console.log('✅ تم عرض البطاقات بنجاح');
    }

    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toFixed(0);
    }
}

// دوال النافذة المنبثقة
function openModal(symbol) {
    const modal = document.getElementById('coinModal');
    const modalBody = document.getElementById('modalBody');
    
    // البحث عن العملة
    const yaserCrypto = window.yaserCryptoInstance;
    if (!yaserCrypto || !yaserCrypto.coins) {
        console.error('لا يمكن العثور على بيانات العملات');
        return;
    }
    
    const coin = yaserCrypto.coins.find(c => c.symbol === symbol);
    if (!coin) {
        console.error(`لا يمكن العثور على العملة ${symbol}`);
        return;
    }
    
    const indicators = coin.technicalIndicators;
    const conditions = coin.conditions;
    
    // تحديد أيقونة المركز
    let rankIcon = '';
    if (coin.rank === 1) rankIcon = '🥇';
    else if (coin.rank === 2) rankIcon = '🥈';
    else if (coin.rank === 3) rankIcon = '🥉';
    else rankIcon = `#${coin.rank}`;
    
    // تحديد أيقونة المصدر
    const sourceIcon = coin.dataSource === 'binance' ? '🟡 Binance' : '🔵 OKX';
    const priorityBadge = coin.priority === 3 ? '<span class="priority-badge">⭐ مؤكد من مصدرين</span>' : '';
    
    modalBody.innerHTML = `
        <div class="modal-header">
            <h2>${rankIcon} ${coin.symbol} ${priorityBadge}</h2>
            <div class="source-info">${sourceIcon}</div>
        </div>
        
        <div class="modal-content-grid">
            <div class="price-section">
                <h3>معلومات السعر</h3>
                <div class="price-info">
                    <div class="current-price">$${coin.price.toFixed(6)}</div>
                    <div class="price-change ${coin.change24h >= 0 ? 'positive' : 'negative'}">
                        ${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%
                    </div>
                </div>
                <div class="price-range">
                    <div>أعلى 24س: $${coin.high24h.toFixed(6)}</div>
                    <div>أقل 24س: $${coin.low24h.toFixed(6)}</div>
                    <div>الحجم: ${yaserCrypto.formatNumber(coin.volume)}</div>
                </div>
            </div>
            
            <div class="score-section">
                <h3>نقاط التحليل</h3>
                <div class="score-display">
                    <div class="score-number">${coin.score}</div>
                    <div class="score-label">نقطة</div>
                </div>
                <div class="rank-info">المركز: ${rankIcon}</div>
            </div>
        </div>
        
        <div class="technical-section">
            <h3>المؤشرات الفنية</h3>
            <div class="indicators-grid">
                <div class="indicator-item">
                    <span class="indicator-label">RSI:</span>
                    <span class="indicator-value ${conditions.rsiGood ? 'good' : 'warning'}">${indicators.rsi.toFixed(1)}</span>
                    <span class="indicator-status">${conditions.rsiGood ? '✅' : '⚠️'}</span>
                </div>
                <div class="indicator-item">
                    <span class="indicator-label">MFI:</span>
                    <span class="indicator-value ${conditions.mfiHealthy ? 'good' : 'warning'}">${indicators.mfi.toFixed(1)}</span>
                    <span class="indicator-status">${conditions.mfiHealthy ? '✅' : '⚠️'}</span>
                </div>
                <div class="indicator-item">
                    <span class="indicator-label">MACD:</span>
                    <span class="indicator-value ${conditions.macdBullish ? 'good' : 'warning'}">${indicators.macd.toFixed(4)}</span>
                    <span class="indicator-status">${conditions.macdBullish ? '✅' : '⚠️'}</span>
                </div>
                <div class="indicator-item">
                    <span class="indicator-label">CVD:</span>
                    <span class="indicator-value ${conditions.cvdBullish ? 'good' : 'warning'}">${indicators.cvd.trend}</span>
                    <span class="indicator-status">${conditions.cvdBullish ? '✅' : '⚠️'}</span>
                </div>
                <div class="indicator-item">
                    <span class="indicator-label">EMA20:</span>
                    <span class="indicator-value">${indicators.ema20.toFixed(6)}</span>
                    <span class="indicator-status">${conditions.priceAboveEMA ? '✅' : '⚠️'}</span>
                </div>
                <div class="indicator-item">
                    <span class="indicator-label">Parabolic SAR:</span>
                    <span class="indicator-value">${indicators.parabolicSAR.toFixed(6)}</span>
                    <span class="indicator-status">📊</span>
                </div>
            </div>
        </div>
        
        <div class="targets-section">
            <h3>🎯 أهداف فيبوناتشي</h3>
            <div class="targets-grid">
                <div class="target-item target-1">
                    <span class="target-label">الهدف الأول:</span>
                    <span class="target-value">$${coin.targets.target1.toFixed(6)}</span>
                    <span class="target-percent">+${(((coin.targets.target1 - coin.price) / coin.price) * 100).toFixed(2)}%</span>
                </div>
                <div class="target-item target-2">
                    <span class="target-label">الهدف الثاني:</span>
                    <span class="target-value">$${coin.targets.target2.toFixed(6)}</span>
                    <span class="target-percent">+${(((coin.targets.target2 - coin.price) / coin.price) * 100).toFixed(2)}%</span>
                </div>
                <div class="target-item target-3">
                    <span class="target-label">الهدف الثالث:</span>
                    <span class="target-value">$${coin.targets.target3.toFixed(6)}</span>
                    <span class="target-percent">+${(((coin.targets.target3 - coin.price) / coin.price) * 100).toFixed(2)}%</span>
                </div>
                <div class="target-item stop-loss">
                    <span class="target-label">🛑 وقف الخسارة:</span>
                    <span class="target-value">$${coin.targets.stopLoss.toFixed(6)}</span>
                    <span class="target-percent">${(((coin.targets.stopLoss - coin.price) / coin.price) * 100).toFixed(2)}%</span>
                </div>
            </div>
        </div>
        
        <div class="conditions-section">
            <h3>شروط التحليل</h3>
            <div class="conditions-grid">
                <div class="condition-item ${conditions.rsiGood ? 'met' : 'not-met'}">
                    <span class="condition-icon">${conditions.rsiGood ? '✅' : '❌'}</span>
                    <span class="condition-text">RSI في المنطقة الصحية</span>
                </div>
                <div class="condition-item ${conditions.macdBullish ? 'met' : 'not-met'}">
                    <span class="condition-icon">${conditions.macdBullish ? '✅' : '❌'}</span>
                    <span class="condition-text">MACD في اتجاه صاعد</span>
                </div>
                <div class="condition-item ${conditions.mfiHealthy ? 'met' : 'not-met'}">
                    <span class="condition-icon">${conditions.mfiHealthy ? '✅' : '❌'}</span>
                    <span class="condition-text">تدفق نقدي صحي</span>
                </div>
                <div class="condition-item ${conditions.cvdBullish ? 'met' : 'not-met'}">
                    <span class="condition-icon">${conditions.cvdBullish ? '✅' : '❌'}</span>
                    <span class="condition-text">حجم التداول صاعد</span>
                </div>
                <div class="condition-item ${conditions.priceAboveEMA ? 'met' : 'not-met'}">
                    <span class="condition-icon">${conditions.priceAboveEMA ? '✅' : '❌'}</span>
                    <span class="condition-text">السعر فوق المتوسط المتحرك</span>
                </div>
                <div class="condition-item ${conditions.volumeGood ? 'met' : 'not-met'}">
                    <span class="condition-icon">${conditions.volumeGood ? '✅' : '❌'}</span>
                    <span class="condition-text">حجم تداول كافي</span>
                </div>
                <div class="condition-item ${conditions.changePositive ? 'met' : 'not-met'}">
                    <span class="condition-icon">${conditions.changePositive ? '✅' : '❌'}</span>
                    <span class="condition-text">تغيير إيجابي خلال 24 ساعة</span>
                </div>
                <div class="condition-item ${conditions.multiSource ? 'met' : 'not-met'}">
                    <span class="condition-icon">${conditions.multiSource ? '✅' : '❌'}</span>
                    <span class="condition-text">مؤكد من مصادر متعددة</span>
                </div>
            </div>
        </div>
        
        <div class="recommendation-section">
            <h3>التوصية</h3>
            <div class="recommendation-content">
                ${getRecommendation(coin)}
            </div>
        </div>
        
        <div class="modal-footer">
            <div class="data-source">
                <small>مصدر البيانات: ${sourceIcon} | آخر تحديث: ${new Date().toLocaleString('ar-SA')}</small>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

function getRecommendation(coin) {
    const score = coin.score;
    const conditions = coin.conditions;
    
    let recommendation = '';
    let riskLevel = '';
    let investmentPercent = '';
    
    if (score >= 90) {
        recommendation = '🟢 توصية قوية بالشراء';
        riskLevel = 'منخفض';
        investmentPercent = '50%';
    } else if (score >= 80) {
        recommendation = '🟡 توصية بالشراء';
        riskLevel = 'متوسط';
        investmentPercent = '30%';
    } else if (score >= 75) {
        recommendation = '🟠 يمكن الشراء بحذر';
        riskLevel = 'متوسط إلى عالي';
        investmentPercent = '20%';
    } else if (score >= 60) {
        recommendation = '⚪ محايد - انتظار';
        riskLevel = 'عالي';
        investmentPercent = '10%';
    } else {
        recommendation = '🔴 لا ينصح بالشراء';
        riskLevel = 'عالي جداً';
        investmentPercent = '0%';
    }
    
    const metConditions = Object.values(conditions).filter(Boolean).length;
    const totalConditions = Object.keys(conditions).length;
    
    return `
        <div class="recommendation-box">
            <div class="recommendation-title">${recommendation}</div>
            <div class="recommendation-details">
                <div class="detail-item">
                    <span class="detail-label">مستوى المخاطر:</span>
                    <span class="detail-value">${riskLevel}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">نسبة الاستثمار المقترحة:</span>
                    <span class="detail-value">${investmentPercent}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">الشروط المحققة:</span>
                    <span class="detail-value">${metConditions}/${totalConditions}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">المصدر:</span>
                    <span class="detail-value">${coin.priority === 3 ? 'مؤكد من مصدرين ⭐' : coin.dataSource.toUpperCase()}</span>
                </div>
            </div>
        </div>
        
        <div class="investment-strategy">
            <h4>💡 استراتيجية الاستثمار:</h4>
            <ul>
                <li>ادخل بالسعر الحالي أو عند انخفاض طفيف</li>
                <li>ضع وقف الخسارة عند: $${coin.targets.stopLoss.toFixed(6)}</li>
                <li>الهدف الأول: $${coin.targets.target1.toFixed(6)} (+${(((coin.targets.target1 - coin.price) / coin.price) * 100).toFixed(2)}%)</li>
                <li>الهدف الثاني: $${coin.targets.target2.toFixed(6)} (+${(((coin.targets.target2 - coin.price) / coin.price) * 100).toFixed(2)}%)</li>
                <li>الهدف الثالث: $${coin.targets.target3.toFixed(6)} (+${(((coin.targets.target3 - coin.price) / coin.price) * 100).toFixed(2)}%)</li>
            </ul>
        </div>
        
        <div class="risk-warning">
            <h4>⚠️ تحذير المخاطر:</h4>
            <p>التداول في العملات المشفرة ينطوي على مخاطر عالية. لا تستثمر أكثر مما يمكنك تحمل خسارته. هذا التحليل لأغراض تعليمية فقط وليس نصيحة استثمارية.</p>
        </div>
    `;
}

function closeModal() {
    const modal = document.getElementById('coinModal');
    modal.style.display = 'none';
}

// إغلاق النافذة المنبثقة عند النقر خارجها
window.onclick = function(event) {
    const modal = document.getElementById('coinModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// تشغيل التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 بدء تشغيل محلل العملات المشفرة - نسخة مطورة مع مصادر متعددة');
    window.yaserCryptoInstance = new YaserCrypto();
});
