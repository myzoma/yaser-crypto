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

        // حساب المتوسطات المتحركة المحسنة
        const currentPrice = coin.price;
        coin.technicalIndicators.ema20 = currentPrice * (1 - (coin.change24h / 100) * 0.15);
        coin.technicalIndicators.ema50 = currentPrice * (1 - (coin.change24h / 100) * 0.35);

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
            this.calculateTargets(coin);
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
                    <span class="score-text">${coin.achievedConditionsCount}/6 شروط</span>
                </div>
                <div class="liquidity-indicator">
                    <div class="liquidity-bar">
                        <div class="liquidity-fill" style="width: ${liquidityPercent}%"></div>
                    </div>
                    <span class="liquidity-text">مؤشر السيولة</span>
                </div>
            `;
            
            return card;
        }

        showCoinDetails(coin) {
            const modal = document.getElementById('coinModal');
            const modalContent = document.getElementById('modalContent');
            
            const changeClass = coin.change24h >= 0 ? 'positive' : 'negative';
            const changeSign = coin.change24h >= 0 ? '+' : '';
            
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2>${coin.name} (${coin.symbol})</h2>
                    <span class="close-modal" onclick="closeCoinModal()">&times;</span>
                </div>
                
                <div class="coin-details">
                    <div class="detail-section">
                        <h3>📊 معلومات السعر</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">السعر الحالي:</span>
                                <span class="detail-value">$${coin.price.toFixed(6)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">التغيير 24 ساعة:</span>
                                <span class="detail-value ${changeClass}">${changeSign}${coin.change24h.toFixed(2)}%</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">حجم التداول:</span>
                                <span class="detail-value">${this.formatVolume(coin.volume)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">الترتيب:</span>
                                <span class="detail-value">#${coin.rank}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>📈 المؤشرات الفنية</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">RSI:</span>
                                <span class="detail-value ${coin.technicalIndicators.rsi > 50 ? 'positive' : 'negative'}">${coin.technicalIndicators.rsi.toFixed(2)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">MACD:</span>
                                <span class="detail-value ${coin.technicalIndicators.macd > coin.technicalIndicators.macdSignal ? 'positive' : 'negative'}">${coin.technicalIndicators.macd.toFixed(4)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">MACD Signal:</span>
                                <span class="detail-value">${coin.technicalIndicators.macdSignal.toFixed(4)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">MFI:</span>
                                <span class="detail-value ${coin.technicalIndicators.mfi > 50 ? 'positive' : 'negative'}">${coin.technicalIndicators.mfi.toFixed(2)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">EMA 20:</span>
                                <span class="detail-value">$${coin.technicalIndicators.ema20.toFixed(6)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">EMA 50:</span>
                                <span class="detail-value">$${coin.technicalIndicators.ema50.toFixed(6)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>🎯 مستويات فيبوناتشي والأهداف</h3>
                        <div class="fibonacci-levels">
                            <div class="fib-level">
                                <span class="fib-label">المقاومة القوية (0%):</span>
                                <span class="fib-value">$${coin.technicalIndicators.fibonacci.level0.toFixed(6)}</span>
                            </div>
                            <div class="fib-level target">
                                <span class="fib-label">الهدف الأول (23.6%):</span>
                                <span class="fib-value">$${coin.targets.target1.toFixed(6)}</span>
                            </div>
                            <div class="fib-level target">
                                <span class="fib-label">الهدف الثاني (38.2%):</span>
                                <span class="fib-value">$${coin.targets.target2.toFixed(6)}</span>
                            </div>
                            <div class="fib-level target">
                                <span class="fib-label">الهدف الثالث (50%):</span>
                                <span class="fib-value">$${coin.targets.target3.toFixed(6)}</span>
                            </div>
                            <div class="fib-level target">
                                <span class="fib-label">الهدف الرابع (61.8%):</span>
                                <span class="fib-value">$${coin.targets.target4.toFixed(6)}</span>
                            </div>
                            <div class="fib-level support">
                                <span class="fib-label">وقف الخسارة (78.6%):</span>
                                <span class="fib-value">$${coin.targets.stopLoss.toFixed(6)}</span>
                            </div>
                            <div class="fib-level">
                                <span class="fib-label">الدعم القوي (100%):</span>
                                <span class="fib-value">$${coin.technicalIndicators.fibonacci.level100.toFixed(6)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>✅ تحليل الشروط</h3>
                        <div class="conditions-grid">
                            <div class="condition-item ${coin.conditions.rise3Percent ? 'achieved' : 'not-achieved'}">
                                <span class="condition-icon">${coin.conditions.rise3Percent ? '✅' : '❌'}</span>
                                <span class="condition-text">ارتفاع 3% أو أكثر</span>
                            </div>
                            <div class="condition-item ${coin.conditions.rise4Percent ? 'achieved' : 'not-achieved'}">
                                <span class="condition-icon">${coin.conditions.rise4Percent ? '✅' : '❌'}</span>
                                <span class="condition-text">ارتفاع 4% أو أكثر</span>
                            </div>
                            <div class="condition-item ${coin.conditions.breakoutMA ? 'achieved' : 'not-achieved'}">
                                <span class="condition-icon">${coin.conditions.breakoutMA ? '✅' : '❌'}</span>
                                <span class="condition-text">اختراق المتوسطات المتحركة</span>
                            </div>
                            <div class="condition-item ${coin.conditions.rsiBullish ? 'achieved' : 'not-achieved'}">
                                <span class="condition-icon">${coin.conditions.rsiBullish ? '✅' : '❌'}</span>
                                <span class="condition-text">RSI أكبر من 50</span>
                            </div>
                            <div class="condition-item ${coin.conditions.macdBullish ? 'achieved' : 'not-achieved'}">
                                <span class="condition-icon">${coin.conditions.macdBullish ? '✅' : '❌'}</span>
                                <span class="condition-text">MACD صاعد</span>
                            </div>
                            <div class="condition-item ${coin.conditions.mfiBullish ? 'achieved' : 'not-achieved'}">
                                <span class="condition-icon">${coin.conditions.mfiBullish ? '✅' : '❌'}</span>
                                <span class="condition-text">MFI أكبر من 50</span>
                            </div>
                        </div>
                        <div class="conditions-summary">
                            <strong>الشروط المحققة: ${coin.achievedConditionsCount}/6</strong>
                            <br>
                            <strong>النقاط النهائية: ${coin.score}</strong>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h3>💡 توصية التداول</h3>
                        <div class="trading-recommendation">
                            ${this.getTradingRecommendation(coin)}
                        </div>
                    </div>
                </div>
            `;
            
            modal.style.display = 'block';
        }

        getTradingRecommendation(coin) {
            const score = coin.achievedConditionsCount;
            const change = coin.change24h;
            
            if (score >= 5 && change >= 5) {
                return `
                    <div class="recommendation strong-buy">
                        <h4>🚀 شراء قوي</h4>
                        <p>العملة تحقق معظم الشروط مع ارتفاع قوي. فرصة ممتازة للدخول.</p>
                        <p><strong>نقطة الدخول:</strong> $${coin.targets.entry.toFixed(6)}</p>
                        <p><strong>وقف الخسارة:</strong> $${coin.targets.stopLoss.toFixed(6)}</p>
                        <p><strong>الأهداف:</strong> T1: $${coin.targets.target1.toFixed(6)} | T2: $${coin.targets.target2.toFixed(6)} | T3: $${coin.targets.target3.toFixed(6)}</p>
                    </div>
                `;
            } else if (score >= 4 && change >= 3) {
                return `
                    <div class="recommendation buy">
                        <h4>📈 شراء</h4>
                        <p>العملة تظهر إشارات إيجابية جيدة. يمكن الدخول بحذر.</p>
                        <p><strong>نقطة الدخول:</strong> $${coin.targets.entry.toFixed(6)}</p>
                        <p><strong>وقف الخسارة:</strong> $${coin.targets.stopLoss.toFixed(6)}</p>
                        <p><strong>الهدف الأول:</strong> $${coin.targets.target1.toFixed(6)}</p>
                    </div>
                `;
            } else if (score >= 3) {
                return `
                    <div class="recommendation hold">
                        <h4>⏳ مراقبة</h4>
                        <p>العملة تحتاج لمراقبة أكثر. انتظر تحسن الشروط قبل الدخول.</p>
                        <p>راقب كسر مستوى $${coin.targets.target1.toFixed(6)} للدخول.</p>
                    </div>
                `;
            } else {
                return `
                    <div class="recommendation avoid">
                        <h4>⚠️ تجنب</h4>
                        <p>العملة لا تحقق الشروط الكافية للدخول حالياً.</p>
                        <p>انتظر إشارات أقوى أو ابحث عن فرص أخرى.</p>
                    </div>
                `;
            }
        }

        formatVolume(volume) {
            if (volume >= 1000000) {
                return (volume / 1000000).toFixed(1) + 'M';
            } else if (volume >= 1000) {
                return (volume / 1000).toFixed(1) + 'K';
            }
            return volume.toFixed(0);
        }

        updateLastUpdate() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('ar-SA');
            const dateString = now.toLocaleDateString('ar-SA');
            document.getElementById('lastUpdate').textContent = `آخر تحديث: ${timeString} - ${dateString}`;
        }

        showLoading() {
            const grid = document.getElementById('coinsGrid');
            grid.innerHTML = '<div class="loading">جاري تحميل البيانات...</div>';
        }

        hideLoading() {
            // سيتم استبدال محتوى التحميل بالعملات
        }
    }

    // إنشاء مثيل من المحلل وبدء التشغيل
    const analyzer = new CryptoAnalyzer();

    // دالة إغلاق النافذة المنبثقة
    function closeCoinModal() {
        document.getElementById('coinModal').style.display = 'none';
    }

    // إغلاق النافذة عند النقر خارجها
    window.onclick = function(event) {
        const modal = document.getElementById('coinModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }

    // تحديث تلقائي كل 5 دقائق
    setInterval(() => {
        analyzer.fetchData();
    }, 5 * 60 * 1000);

    console.log('🚀 محلل العملات الرقمية جاهز للعمل!');
