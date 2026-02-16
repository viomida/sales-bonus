/**
 * Функция для расчета выручки - ИСПРАВЛЕНО
 */
function calculateSimpleRevenue(purchase, _product) {
    if (!purchase || typeof purchase !== 'object') return 0;
    
    // В данных поле называется "amount" (как в твоем примере)
    if (typeof purchase.amount === 'number') {
        return purchase.amount;
    }
    
    // Если amount нет, пробуем другие варианты
    if (typeof purchase.price === 'number') {
        const quantity = typeof purchase.quantity === 'number' ? purchase.quantity : 1;
        return purchase.price * quantity;
    }
    
    // Если ничего нет, возвращаем 0
    console.warn('Cannot calculate revenue for:', purchase);
    return 0;
}

/**
 * Функция для расчета бонусов
 */
function calculateBonusByProfit(index, total, seller) {
    if (index === 0) return 1000;
    if (index === 1) return 500;
    if (index === 2) return 250;
    return 0;
}

/**
 * Главная функция анализа - ИСПРАВЛЕННАЯ ВЕРСИЯ
 */
function analyzeSalesData(data, options = {}) {
    // ========== ВАЛИДАЦИЯ ==========
    if (!data || typeof data !== 'object') {
        return [];
    }
    
    // Извлекаем данные
    const sellers = Array.isArray(data.sellers) ? data.sellers : [];
    const products = Array.isArray(data.products) ? data.products : [];
    const purchaseRecords = Array.isArray(data.purchase_records) ? data.purchase_records : [];
    
    console.log('Processing records:', purchaseRecords.length); // Для отладки
    
    // Создаем справочники
    const sellersMap = {};
    sellers.forEach(s => { if (s?.id) sellersMap[s.id] = s; });
    
    const productsMap = {};
    products.forEach(p => { if (p?.id) productsMap[p.id] = p; });
    
    // ========== СБОР СТАТИСТИКИ ==========
    const stats = {};
    
    purchaseRecords.forEach(record => {
        if (!record?.seller_id) return;
        
        const sellerId = record.seller_id;
        const productId = record.product_id;
        
        // Инициализация статистики продавца
        if (!stats[sellerId]) {
            const seller = sellersMap[sellerId] || {};
            stats[sellerId] = {
                seller_id: sellerId,
                name: seller.name || `Продавец ${sellerId}`,
                sales_count: 0,
                revenue: 0,
                profit: 0,
                _products: {}
            };
        }
        
        const stat = stats[sellerId];
        
        // ВАЖНО: Правильно получаем сумму из amount
        const amount = typeof record.amount === 'number' ? record.amount : 0;
        
        // Количество (если есть)
        const quantity = typeof record.quantity === 'number' ? record.quantity : 1;
        
        // Выручка = amount (это уже общая сумма)
        const revenue = amount;
        
        // Прибыль (пока равна выручке, если нет себестоимости)
        const profit = revenue; // Временно так
        
        // Обновляем статистику
        stat.sales_count += quantity;
        stat.revenue += revenue;
        stat.profit += profit;
        
        // Статистика по товарам
        if (productId) {
            if (!stat._products[productId]) {
                const product = productsMap[productId] || {};
                stat._products[productId] = {
                    id: productId,
                    name: product.name || `Товар ${productId}`,
                    quantity: 0,
                    revenue: 0
                };
            }
            stat._products[productId].quantity += quantity;
            stat._products[productId].revenue += revenue;
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

// ========== ТЕСТ С РЕАЛЬНЫМИ ДАННЫМИ ==========
const testData = {
    customers: Array(10).fill({ id: "c1", name: "Customer" }),
    products: Array(100).fill({ id: "p1", name: "Product" }),
    sellers: [
        { id: "seller_1", name: "Продавец 1" },
        { id: "seller_2", name: "Продавец 2" },
        { id: "seller_3", name: "Продавец 3" },
        { id: "seller_4", name: "Продавец 4" },
        { id: "seller_5", name: "Продавец 5" }
    ],
    purchase_records: [
        // Здесь должны быть реальные записи с amount
        { id: "r1", product_id: "p1", seller_id: "seller_1", amount: 1000, quantity: 1 },
        { id: "r2", product_id: "p2", seller_id: "seller_1", amount: 500, quantity: 1 },
        // ... и так далее
    ]
};

// Экспорт для тестов
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateSimpleRevenue,
        calculateBonusByProfit,
        analyzeSalesData
    };
}