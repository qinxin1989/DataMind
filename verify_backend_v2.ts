import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsInVzZXJuYW1lIjoiYWRtaW4iLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwiZnVsbE5hbWUiOiLns7vnu5_nrqHnkIblkZgiLCJyb2xlIjoiYWRtaW4iLCJzdGF0dXMiOiJhY3RpdmUiLCJjcmVhdGVkQXQiOjE3NjgyOTcyMzAwMDAsInVwZGF0ZWRBdCI6MTc2OTE1ODU2MzAwMCwiaWF0IjoxNzY5MTU5MTA1LCJleHAiOjE3Njk3NjM5MDV9.hRBkziweYoSVEJsYAFDhRdwvg48-i-dPFfb54EtyIZw';
const API_URL = 'http://localhost:3000/api/tools/file';

async function verify() {
    try {
        console.log('--- Step 1: Upload and Convert ---');
        const form = new FormData();
        // Use the confirmed real PDF
        const sourcePdf = path.join(process.cwd(), 'uploads', 'tools', '63698764-fb9e-4ad2-80c9-638ee6e0f64d.pdf');

        form.append('files', fs.createReadStream(sourcePdf), 'test_001.pdf');
        form.append('sourceFormat', 'pdf');
        form.append('targetFormat', 'txt');

        const convRes = await axios.post(`${API_URL}/convert`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${TOKEN}`
            }
        });

        // Search for JSON in the potentially polluted output if necessary, 
        // but here we expect clean JSON since I removed the text console.log
        console.log('Convert Response:', convRes.data);
        const { fileId, safeName } = convRes.data;

        if (!fileId) throw new Error('No fileId received');

        console.log('\n--- Step 2: Download with ID ---');
        const downRes = await axios.get(`${API_URL}/download/${fileId}`, {
            params: { name: safeName },
            headers: { 'Authorization': `Bearer ${TOKEN}` },
            responseType: 'arraybuffer'
        });

        const contentDisp = downRes.headers['content-disposition'] || '';
        console.log('Content-Disposition:', contentDisp);

        if (contentDisp.includes(safeName) || contentDisp.includes(encodeURIComponent(safeName))) {
            console.log('SUCCESS: Filename found in Header!');
        } else {
            console.log('FAILURE: Filename mismatch.');
        }

        console.log('File content size:', downRes.data.byteLength);

    } catch (error: any) {
        if (error.response) {
            console.error('Verification failed:', error.response.status, error.response.data.toString());
        } else {
            console.error('Verification failed:', error.message);
        }
    }
}

verify();
