import * as fs from 'fs';
import * as path from 'path';

async function testPdfParse() {
    try {
        console.log('Loading pdf-parse...');
        const mod = await import('pdf-parse');
        console.log('Module keys:', Object.keys(mod));
        const { PDFParse } = mod;
        console.log('PDFParse loaded:', typeof PDFParse);


        // Find a pdf file to test
        const uploadDir = path.join(process.cwd(), 'uploads', 'tools');
        const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.pdf'));


        if (files.length === 0) {
            console.log('No PDF files found in uploads directory to test.');
            return;
        }

        const testFile = path.join(uploadDir, files[0]);
        console.log('Testing with file:', testFile);

        const dataBuffer = fs.readFileSync(testFile);
        const parser = new PDFParse({ data: dataBuffer });
        const textResult = await parser.getText();

        console.log('Extracted text length:', textResult.text.length);
        console.log('First 100 chars:', textResult.text.substring(0, 100));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testPdfParse();
