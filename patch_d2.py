with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

count = h.count('.screen *{-webkit-user-select:none')
print("screen* count:", count)

idx1 = h.find('.screen *{-webkit-user-select:none')
idx2 = h.find('.screen *{-webkit-user-select:none', idx1+1)
print("First at char:", idx1, "Second at char:", idx2)

if idx2 > 0:
    block_start = h.rfind('\n', 0, idx2) + 1
    block_end = h.find('\n', h.find('}', idx2 + 80)) + 1
    print("Block to remove:")
    print(repr(h[block_start:block_end]))
    h = h[:block_start] + h[block_end:]
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(h)
    print("Removed. New size:", len(h))
else:
    print("Duplikat nenajdeny - mozno uz opraveny")
