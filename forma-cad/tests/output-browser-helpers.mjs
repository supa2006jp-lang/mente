export async function openOutput(page,selector='#export'){
 await page.locator(selector).click();
 return page.locator('#export-confirm');
}

export async function confirmOutput(page,selector){
 await (await openOutput(page,selector)).click();
}
