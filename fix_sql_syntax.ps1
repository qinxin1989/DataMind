$files = Get-ChildItem -Path "modules" -Filter "service.ts" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # 替换 db.get (简单情况)
    $content = $content -replace 'const\s+(\w+)\s+=\s+await\s+this\.db\.get\(', 'const [$1Rows]: any = await this.db.execute('
    $content = $content -replace 'await\s+this\.db\.get\(', 'await this.db.execute('
    
    # 替换 db.run
    $content = $content -replace 'await\s+this\.db\.run\(', 'await this.db.execute('
    
    # 替换 db.all
    $content = $content -replace 'const\s+(\w+)\s+=\s+await\s+this\.db\.all\(', 'const [$1]: any = await this.db.execute('
    $content = $content -replace 'await\s+this\.db\.all\(', 'await this.db.execute('
    
    Set-Content $file.FullName $content
}
