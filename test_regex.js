const text = `
Here are 3 images:
![Image 1](https://example.com/img1.png)
![Image 2 (Long)](https://example.com/img2_long.png)
![Image 3](https://example.com/img3.webp)
`;

const regex = /!\[(.*?)\]\((.*?)\)/g;
const processed = text.replace(regex, (match, alt, url) => {
    return `[![$[alt]]($[url])]($[url])`.replace('$[alt]', alt).replace(/\$\[url\]/g, url);
});

console.log('Original Text:');
console.log(text);
console.log('\nProcessed Text:');
console.log(processed);

const text2 = '![img1](url1)![img2](url2)![img3](url3)';
const processed2 = text2.replace(regex, (match, alt, url) => {
    return `[![$[alt]]($[url])]($[url])`.replace('$[alt]', alt).replace(/\$\[url\]/g, url);
});
console.log('\nCompact Text:');
console.log(processed2);
