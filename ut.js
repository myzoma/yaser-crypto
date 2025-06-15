        const signalsHTML = signals.map(signal => {
            const signalColor = signal.type === 'BUY' ? '#4CAF50' : '#f44336';
            const signalIcon = signal.type === 'BUY' ? '🟢' : '🔴';
            const signalText = signal.type === 'BUY' ? 'شراء' : 'بيع';
            
            return `
                <div class="${signal.type.toLowerCase()}-signal-item" title="قوة الإشارة: ${signal.strength.toFixed(2)}%">
                    <div class="signal-header">
                        <span class="timeframe-indicator">${signal.timeframe}</span>
                        <span style="color: ${signalColor};">${signalIcon} ${signalText}</span>
                        <strong>${signal.symbol.replace('-USDT', '/USDT')}</strong>
                        <span style="color: ${signalColor}; font-weight: bold;">$${signal.price}</span>
                        <span style="color: ${parseFloat(signal.change24h) >= 0 ? '#4CAF50' : '#f44336'}; margin-left: 5px;">
                            (${signal.change24h}%)
                        </span>
                    </div>
                    <div class="targets-info" style="margin-top: 5px; font-size: 12px; color: #666;">
                        🎯 <span style="color: #4CAF50;">هدف: $${signal.targets.profitTarget}</span> | 
                        🛑 <span style="color: #f44336;">ستوب: $${signal.targets.stopLoss}</span> | 
                        📊 <span style="color: #2196F3;">نسبة: ${signal.targets.riskReward}:1</span>
                    </div>
                    <div class="atr-info" style="margin-top: 3px; font-size: 11px; color: #999;">
                        ATR: ${signal.targets.atrValue} | قوة: ${signal.strength.toFixed(1)}%
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = signalsHTML;
        
        console.log(`🎉 تم عرض ${signals.length} إشارة مع الأهداف في الشريط`);
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الإشارات:', error);
        container.innerHTML = '<div class="ut-bot-loading">❌ خطأ في تحميل البيانات</div>';
    }
}

// 🎯 دالة إضافية لتحديث إعدادات الأهداف
function updateTargetSettings(profitMultiplier, stopMultiplier, atrPeriod) {
    utScanner.targetSettings.profitMultiplier = profitMultiplier || 2.5;
    utScanner.targetSettings.stopMultiplier = stopMultiplier || 1.5;
    utScanner.targetSettings.atrPeriod = atrPeriod || 10;
    
    console.log('🔧 تم تحديث إعدادات الأهداف:', utScanner.targetSettings);
}

// 🎯 دالة لحساب الأهداف لعملة محددة (للاستخدام الخارجي)
async function calculateTargetsForSymbol(symbol, timeframe = '1H') {
    try {
        const signal = await utScanner.checkUTBotSignal(symbol, timeframe);
        if (signal && signal.targets) {
            console.log(`🎯 أهداف ${symbol}:`, signal.targets);
            return signal.targets;
        }
        return null;
    } catch (error) {
        console.error(`❌ خطأ في حساب أهداف ${symbol}:`, error);
        return null;
    }
}

// بدء التشغيل
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUTBotSignals);
} else {
    loadUTBotSignals();
}

// تحديث كل 12 دقيقة
setInterval(loadUTBotSignals, 720000);

console.log('🚀 UT Bot Scanner مع حساب الأهداف - جاهز للعمل!');
console.log('🎯 الميزات الجديدة:');
console.log('   ✅ حساب أهداف الربح تلقائياً');
console.log('   ✅ حساب وقف الخسارة تلقائياً');
console.log('   ✅ نسبة المخاطرة/العائد');
console.log('   ✅ قيمة ATR لكل إشارة');
console.log('🔧 لتغيير الإعدادات: updateTargetSettings(profitMultiplier, stopMultiplier, atrPeriod)');
