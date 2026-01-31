
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function generateExcel() {
    const dataDir = __dirname;
    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('fixed_') && f.endsWith('.json'));

    let allData = [];

    files.forEach(file => {
        try {
            const content = fs.readFileSync(path.join(dataDir, file), 'utf8');
            const json = JSON.parse(content);

            if (json.success && json.data && Array.isArray(json.data)) {
                // Determine source name from filename
                const source = file.replace('fixed_', '').replace('.json', '');

                // Add source field to each item
                const items = json.data.map(item => ({
                    "省份/来源": source,
                    "标题": item['标题'] || item.title || '',
                    "发布日期": item['发布日期'] || item.date || '',
                    "链接": item['链接'] || item.link || item.url || ''
                }));

                allData = allData.concat(items);
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    });

    console.log(`Total items collected: ${allData.length}`);

    if (allData.length > 0) {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(allData);

        // Auto-width (simple approximation)
        const wscols = [
            { wch: 15 }, // Source
            { wch: 80 }, // Title
            { wch: 15 }, // Date
            { wch: 100 } // Link
        ];
        worksheet['!cols'] = wscols;

        XLSX.utils.book_append_sheet(workbook, worksheet, "All Policies");

        const outFile = path.join(__dirname, 'crawled_summary_final.xlsx');
        XLSX.writeFile(workbook, outFile);
        console.log(`Excel file created at: ${outFile}`);
    } else {
        console.warn('No data found to export.');
    }
}

generateExcel();
