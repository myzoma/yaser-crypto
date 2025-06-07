// ملف إضافي لتحسين التكامل مع API
class APIIntegration {
    constructor() {
        this.okxBaseUrl = 'https://www.okx.com/api/v5';
        this.requestQueue = [];
        this.isProcessing = false;
        this.rateLimitDelay = 500; // 500ms بين الطلبات
    }

    async queueRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ url, options, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const { url, options, resolve, reject } = this.requestQueue.shift();
            
            try {
                const response = await fetch(url, options);
                const data = await response.json();
                resolve(data);
            } catch (error) {
                reject(error);
            }
            
            // تأخير بين الطلبات لتجنب rate limiting
            if (this.requestQueue.length > 0) {
                await this.delay(this.rateLimitDelay);
            }
        }
        
        this.isProcessing = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getMultiplePrices(symbols) {
        const prices = {};
        
        for (const symbol of symbols) {
            try {
                const data = await this.queueRequest(
                    `${this.okxBaseUrl}/market/ticker?instId=${symbol}-USDT`
                );
                
                if (data.data && data.data.length > 0) {
                    prices[symbol] = parseFloat(data.data[0].last);
                }
            } catch (error) {
                console.error(`خطأ في جلب سعر ${symbol}:`, error);
                prices[symbol] = null;
            }
        }
        
        return prices;
    }
}

// إضافة الكلاس للنافذة العامة
window.APIIntegration = APIIntegration;
