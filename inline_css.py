import os

html_path = r'c:\Users\nethi\OneDrive\Desktop\Project_ByteHearts\static\index.html'
css_path = r'c:\Users\nethi\OneDrive\Desktop\Project_ByteHearts\static\styles.css'

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

style_block = '<style>\n' + css_content + '\n</style>'
target_link = '<link rel="stylesheet" href="styles.css">'

if target_link in html_content:
    html_content = html_content.replace(target_link, style_block)
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print('Successfully inlined CSS.')
else:
    print('Link tag not found. Make sure the href exactly matches "styles.css".')
