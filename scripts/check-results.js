
const fs = require('fs');
const path = require('path');

const files = [
    'fixed_xinjiang.json',
    'fixed_sichuan.json',
    'fixed_hubei.json',
    'fixed_shanghai.json'
];

files.forEach(f => {
    try {
        const p = path.join(__dirname, f);
        if (!fs.existsSync(p)) {
            console.log(`${f}: NOT FOUND`);
            return;
        }
        const c = fs.readFileSync(p, 'utf8');
        const j = JSON.parse(c);
        console.log(`${f}: count=${j.count || (j.data ? j.data.length : 0)}, success=${j.success}`);
        if (j.data && j.data.length > 0) {
            console.log(`  Sample: ${JSON.stringify(j.data[0]).substring(0, 100)}...`);
        }
        if (j.error) {
            console.log(`  Error: ${j.error}`);
        }
    } catch (e) { console.log(`${f}: error ${e.message}`); }
});
