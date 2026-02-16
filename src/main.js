/**
 * Функция для расчета выручки
 * @param {Object} purchase - запись о покупке (receipt)
 * @param {Object} _product - карточка товара (не используется)
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    if (!purchase || typeof purchase !== 'object') return 0;
    
    // В данных уже есть total_amount - это и есть выручка по чеку
    if (typeof purchase.total_amount === 'number') {
        return purchase.total_amount;
    }
    
    // Если нет total_amount, суммируем товары
    if (Array.isArray(purchase.items)) {
        return purchase.items.reduce((sum, item) => {
            return sum + (item.sale_price * item.quantity);
        }, 0);
    }
    
    return 0;
}

/**
 * Функция для расчета бонусов
 * @param {number} index - место в рейтинге (0 - первое)
 * @param {number} total - всего продавцов
 * @param {Object} seller - данные продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (index === 0) return 1000;
    if (index === 1) return 500;
    if (index === 2) return 250;
    return 0;
}

/**
 * Главная функция анализа данных
 * @param {Object} data - объект с customers, products, sellers, purchase_records
 * @param {Object} options - настройки (minProfit и т.д.)
 * @returns {Array} - массив с аналитикой по продавцам
 */
function analyzeSalesData(data, options = {}) {
    // ========== ЗАЩИТА ОТ ОШИБОК ==========
    if (!data || typeof data !== 'object') {
        console.warn('analyzeSalesData: data is not an object');
        return [];
    }
    
    // Извлекаем данные
    const sellers = Array.isArray(data.sellers) ? data.sellers : [];
    const products = Array.isArray(data.products) ? data.products : [];
    const purchaseRecords = Array.isArray(data.purchase_records) ? data.purchase_records : [];
    
    console.log(`Processing ${purchaseRecords.length} receipts...`);
    
    // Создаем справочники для быстрого доступа
    const sellersMap = {};
    sellers.forEach(seller => {
        if (seller?.id) {
            sellersMap[seller.id] = seller;
        }
    });
    
    const productsMap = {};
    products.forEach(product => {
        if (product?.sku) {  // В данных товары используют SKU
            productsMap[product.sku] = product;
        }
    });
    
    // ========== СБОР СТАТИСТИКИ ==========
    const stats = {};
    
    purchaseRecords.forEach(receipt => {
        // Пропускаем чеки без продавца
        if (!receipt?.seller_id) return;
        
        const sellerId = receipt.seller_id;
        
        // Инициализируем запись для продавца
        if (!stats[sellerId]) {
            const seller = sellersMap[sellerId] || {};
            stats[sellerId] = {
                seller_id: sellerId,
                name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || `Продавец ${sellerId}`,
                sales_count: 0,
                revenue: 0,
                profit: 0,
                // Для сбора статистики по товарам
                _products: {}
            };
        }
        
        const stat = stats[sellerId];
        stat.sales_count++;
        
        // Используем total_amount из чека (это уже готовая сумма)
        const receiptTotal = typeof receipt.total_amount === 'number' ? receipt.total_amount : 0;
        
        // Добавляем к общей выручке продавца
        stat.revenue += receiptTotal;
        
        // ПОКА прибыль = выручке (в данных нет себестоимости)
        stat.profit += receiptTotal;
        
        // ========== СБОР СТАТИСТИКИ ПО ТОВАРАМ ==========
        if (Array.isArray(receipt.items)) {
            receipt.items.forEach(item => {
                const sku = item.sku;
                if (!sku) return;
                
                const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
                const salePrice = typeof item.sale_price === 'number' ? item.sale_price : 0;
                const itemTotal = salePrice * quantity;
                
                // Инициализируем товар, если его еще нет
                if (!stat._products[sku]) {
                    const product = productsMap[sku] || {};
                    stat._products[sku] = {
                        id: sku,
                        name: product.name || `Товар ${sku}`,
                        quantity: 0,
                        revenue: 0
                    };
                }
                
                // Добавляем данные по товару
                stat._products[sku].quantity += quantity;
                stat._products[sku].revenue += itemTotal;
            });
        }
    });
    
    // ========== ФОРМИРОВАНИЕ РЕЗУЛЬТАТА ==========
    let result = Object.values(stats);
    
    // Фильтрация по минимальной прибыли
    const minProfit = options.minProfit ?? -Infinity;
    result = result.filter(s => s.profit >= minProfit);
    
    // Сортировка по прибыли (от большей к меньшей)
    result.sort((a, b) => b.profit - a.profit);
    
    // Финальное форматирование
    result = result.map((seller, index) => {
        // Топ-3 товара по выручке
        const topProducts = Object.values(seller._products)
            .filter(p => p.revenue > 0)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3)
            .map(p => ({
                id: p.id,
                name: p.name
            }));
        
        // Удаляем внутреннее поле _products
        const { _products, ...cleanSeller } = seller;
        
        return {
            ...cleanSeller,
            bonus: calculateBonusByProfit(index, result.length, seller),
            top_products: topProducts
        };
    });
    
    return result;
}

// ========== ЭКСПОРТ ДЛЯ ТЕСТОВ ==========
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateSimpleRevenue,
        calculateBonusByProfit,
        analyzeSalesData
    };
}