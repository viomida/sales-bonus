/**
 * Функция для расчета выручки
 * @param {Object} record запись о покупке из purchase_records
 * @param {Object} product карточка товара из products
 * @returns {number}
 */
function calculateSimpleRevenue(record, product) {
    // amount в записи - это, видимо, сумма продажи
    return record.amount || 0;
}

/**
 * Функция для расчета бонусов
 * @param {number} index порядковый номер в рейтинге
 * @param {number} total общее число продавцов
 * @param {Object} seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    if (index === 0) return 1000;
    if (index === 1) return 500;
    if (index === 2) return 250;
    return 0;
}

/**
 * Функция для анализа данных продаж - РАБОЧАЯ ВЕРСИЯ
 * @param {Object} data - объект с customers, products, sellers, purchase_records
 * @param {Object} options - настройки анализа
 * @returns {Array} - массив с аналитикой по продавцам
 */
function analyzeSalesData(data, options) {
    // ========== ПРОВЕРКА ВХОДНЫХ ДАННЫХ ==========
    
    // Проверяем, что data - объект
    if (!data || typeof data !== 'object') {
        console.warn('analyzeSalesData: data is not an object, returning empty array');
        return [];
    }
    
    // Безопасно получаем все массивы
    const customers = Array.isArray(data.customers) ? data.customers : [];
    const products = Array.isArray(data.products) ? data.products : [];
    const sellers = Array.isArray(data.sellers) ? data.sellers : [];
    const purchaseRecords = Array.isArray(data.purchase_records) ? data.purchase_records : [];
    
    // Создаем справочники для быстрого доступа
    const productsMap = {};
    products.forEach(product => {
        if (product && product.id) {
            productsMap[product.id] = product;
        }
    });
    
    const sellersMap = {};
    sellers.forEach(seller => {
        if (seller && seller.id) {
            sellersMap[seller.id] = seller;
        }
    });
    
    // ========== СБОР СТАТИСТИКИ ==========
    
    const sellerStats = {};
    
    // Анализируем каждую запись о продаже
    purchaseRecords.forEach(record => {
        // Пропускаем некорректные записи
        if (!record || !record.seller_id) return;
        
        const sellerId = record.seller_id;
        const productId = record.product_id;
        
        // Получаем данные о продавце и товаре
        const seller = sellersMap[sellerId] || { name: `Продавец ${sellerId}` };
        const product = productsMap[productId] || { name: `Товар ${productId}` };
        
        // Инициализируем статистику продавца
        if (!sellerStats[sellerId]) {
            sellerStats[sellerId] = {
                seller_id: sellerId,
                name: seller.name || `Продавец ${sellerId}`,
                sales_count: 0,
                revenue: 0,
                profit: 0,
                products: {} // для сбора статистики по товарам
            };
        }
        
        const stat = sellerStats[sellerId];
        
        // Получаем сумму из записи (amount)
        const amount = typeof record.amount === 'number' ? record.amount : 0;
        
        // Считаем выручку (для простоты берем amount)
        const revenue = amount;
        
        // Для прибыли нам нужна себестоимость, но её нет в данных
        // Пока используем revenue как profit, но в реальности тут нужна формула
        const profit = revenue; // Временно так
        
        // Обновляем статистику
        stat.sales_count++;
        stat.revenue += revenue;
        stat.profit += profit;
        
        // Статистика по товарам
        if (!stat.products[productId]) {
            stat.products[productId] = {
                id: productId,
                name: product.name || `Товар ${productId}`,
                quantity: 0,
                revenue: 0
            };
        }
        
        stat.products[productId].quantity++;
        stat.products[productId].revenue += revenue;
    });
    
    // ========== ФОРМИРОВАНИЕ РЕЗУЛЬТАТА ==========
    
    // Преобразуем в массив
    let resultArray = Object.values(sellerStats);
    
    // Применяем опции (если есть)
    const { minProfit = -Infinity } = options || {};
    
    // Фильтруем по минимальной прибыли
    resultArray = resultArray.filter(seller => seller.profit >= minProfit);
    
    // Сортируем по прибыли
    resultArray.sort((a, b) => b.profit - a.profit);
    
    // Назначаем бонусы и формируем top_products
    resultArray = resultArray.map((seller, index) => {
        // Добавляем бонус
        seller.bonus = calculateBonusByProfit(index, resultArray.length, seller);
        
        // Формируем топ-3 товара
        const topProducts = Object.values(seller.products)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3)
            .map(p => ({ id: p.id, name: p.name }));
        
        // Убираем промежуточное поле products
        const { products, ...sellerWithoutProducts } = seller;
        
        return {
            ...sellerWithoutProducts,
            top_products: topProducts
        };
    });
    
    return resultArray;
}

// ========== ТЕСТ С РЕАЛЬНЫМИ ДАННЫМИ ==========

// Создаем тестовые данные как на картинке
const testData = {
    customers: [
        { id: "c1", name: "Иван Петров", email: "ivan@mail.com", phone: "+7...", address: "Москва" }
    ],
    products: [
        { id: "p1", name: "Смартфон", price: 1000, quantity: 10, category: "Электроника" },
        { id: "p2", name: "Наушники", price: 500, quantity: 20, category: "Аксессуары" }
    ],
    sellers: [
        { id: "s1", name: "Анна Смирнова", email: "anna@mail.com", phone: "+7...", address: "Москва" },
        { id: "s2", name: "Петр Иванов", email: "petr@mail.com", phone: "+7...", address: "СПб" }
    ],
    purchase_records: [
        { id: "r1", product_id: "p1", seller_id: "s1", date: "2024-01-01", amount: 1000, status: "completed" },
        { id: "r2", product_id: "p2", seller_id: "s1", date: "2024-01-02", amount: 500, status: "completed" },
        { id: "r3", product_id: "p1", seller_id: "s2", date: "2024-01-03", amount: 1000, status: "completed" }
    ]
};

// Запускаем анализ
const result = analyzeSalesData(testData, { minProfit: 0 });
console.log('Результат анализа:', JSON.stringify(result, null, 2));