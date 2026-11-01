const fs = require('fs');
const path = require('path');

const FOOD_DIR = path.join(__dirname, '..', 'public', 'images', 'food');

// Function to convert dish name to safe filename slug
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s*-\s*/g, '-')
    .replace(/[\(\),&']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Map dish characteristics to best base image
function getBaseImageForDish(name, categoryId) {
  const n = name.toLowerCase();

  // Soups
  if (categoryId === 'soups' || n.includes('soup')) {
    if (n.includes('tomato')) return 'tomato-soup';
    if (n.includes('manchow')) return 'manchow-soup';
    return 'hot-sour-soup';
  }

  // Beverages & Shakes
  if (categoryId === 'beverages') {
    if (n.includes('water') || n.includes('soda') || n.includes('soft drink')) return 'mineral-water';
    if (n.includes('lime') || n.includes('lemon')) return 'fresh-lime-soda';
    if (n.includes('lassi') || n.includes('buttermilk') || n.includes('chaas') || n.includes('milk')) return 'lassi';
    if (n.includes('cold coffee')) return 'cold-coffee';
    if (n.includes('shake') || n.includes('milkshake')) return 'chocolate-shake';
    if (n.includes('juice')) return 'fruit-juice';
    if (n.includes('tea') || n.includes('coffee') || n.includes('cappuccino') || n.includes('espresso') || n.includes('chocolate')) return 'chai-tea';
    return 'fruit-juice';
  }

  // Mocktails
  if (categoryId === 'mocktails') {
    if (n.includes('blue') || n.includes('curacao')) return 'blue-lagoon';
    if (n.includes('colada') || n.includes('coconut')) return 'pina-colada';
    if (n.includes('iced tea')) return 'iced-tea';
    if (n.includes('punch') || n.includes('sunrise') || n.includes('rainbow') || n.includes('sangria') || n.includes('temple')) return 'fruit-punch';
    return 'virgin-mojito';
  }

  // Chinese dishes
  if (categoryId === 'chinese-veg' || categoryId === 'chinese-non-veg') {
    if (n.includes('noodle') || n.includes('chowmein') || n.includes('chopsuey')) return 'hakka-noodles';
    if (n.includes('rice')) return 'fried-rice';
    if (n.includes('spring roll') || n.includes('wonton')) return 'spring-roll';
    if (n.includes('momo')) return 'momos';
    if (n.includes('lollipop') || n.includes('wings')) return 'chicken-wings';
    if (n.includes('chicken')) return 'chicken-curry';
    if (n.includes('fish') || n.includes('prawn')) return 'fish-fry';
    return 'chilli-paneer';
  }

  // Breads
  if (categoryId === 'breads') {
    if (n.includes('roti') || n.includes('chapati')) return 'tandoori-roti';
    return 'naan-bread';
  }

  // Rice & Biryani
  if (categoryId === 'rice-biryani') {
    if (n.includes('biryani')) {
      if (n.includes('veg') || n.includes('paneer') || n.includes('mushroom')) return 'veg-biryani';
      return 'chicken-biryani';
    }
    if (n.includes('fried rice')) return 'fried-rice';
    if (n.includes('pulao')) return 'veg-biryani';
    return 'steamed-rice';
  }

  // Non-Veg Main Course
  if (categoryId === 'non-veg-main-course') {
    if (n.includes('butter chicken') || n.includes('tikka masala') || n.includes('lababdar')) return 'butter-chicken';
    if (n.includes('mutton') || n.includes('keema') || n.includes('rogan')) return 'mutton-curry';
    if (n.includes('egg')) return 'egg-curry';
    if (n.includes('fish') || n.includes('prawn')) return 'fish-fry';
    return 'chicken-curry';
  }

  // Veg Main Course
  if (categoryId === 'veg-main-course') {
    if (n.includes('butter masala') || n.includes('shahi') || n.includes('lababdar') || n.includes('tikka masala')) return 'paneer-butter-masala';
    if (n.includes('kadai') || n.includes('palak') || n.includes('matar') || n.includes('do pyaza') || n.includes('bhurji')) return 'kadai-paneer';
    if (n.includes('dal') || n.includes('yellow dal')) return 'dal-makhani';
    if (n.includes('kofta')) return 'kofta';
    if (n.includes('chana') || n.includes('rajma') || n.includes('dum aloo') || n.includes('gobi') || n.includes('bhindi') || n.includes('mushroom')) return 'mix-veg';
    return 'mix-veg';
  }

  // Non-Veg Starters
  if (categoryId === 'non-veg-starters') {
    if (n.includes('tandoori chicken')) return 'tandoori-chicken';
    if (n.includes('seekh') || n.includes('kebab') || n.includes('tangdi') || n.includes('reshmi') || n.includes('afghani')) return 'seekh-kebab';
    if (n.includes('lollipop') || n.includes('wings')) return 'chicken-wings';
    if (n.includes('fish')) return 'fish-fry';
    if (n.includes('prawn')) return 'prawn-fry';
    return 'chicken-tikka';
  }

  // Veg Starters
  if (categoryId === 'veg-starters') {
    if (n.includes('tikka')) return 'paneer-tikka';
    if (n.includes('chilli') || n.includes('manchurian') || n.includes('65')) return 'chilli-paneer';
    if (n.includes('corn') || n.includes('potato') || n.includes('fries')) return 'crispy-corn';
    if (n.includes('kebab') || n.includes('pakoda') || n.includes('cutlet') || n.includes('tikki') || n.includes('balls')) return 'veg-kebab';
    if (n.includes('salad') || n.includes('papad') || n.includes('peanut')) return 'salad';
    return 'paneer-tikka';
  }

  return 'paneer-tikka';
}

// Map category to hero banner
const CATEGORY_HERO_MAP = {
  'veg-starters': 'hero-veg-starters',
  'non-veg-starters': 'hero-non-veg-starters',
  'veg-main-course': 'hero-veg-main-course',
  'non-veg-main-course': 'hero-non-veg-main-course',
  'rice-biryani': 'hero-rice-biryani',
  'breads': 'hero-breads',
  'chinese-veg': 'hero-chinese-veg',
  'chinese-non-veg': 'hero-chinese-non-veg',
  'soups': 'hero-soups',
  'beverages': 'hero-beverages',
  'mocktails': 'hero-mocktails',
};

// Main processing
function run() {
  const menuDataPath = path.join(__dirname, '..', 'src', 'data', 'menuData.ts');
  const hotelDataPath = path.join(__dirname, '..', 'src', 'data', 'hotelData.ts');

  let menuContent = fs.readFileSync(menuDataPath, 'utf8');

  // Extract all categories and items
  const catRegex = /id:\s*'([a-z-]+)',\s*\n\s*title:\s*'([^']+)'[\s\S]*?items:\s*\[([\s\S]*?)\]\s*,?\s*\},?/g;
  let match;
  let createdCount = 0;

  // Track item replacements
  const itemReplacements = [];

  while ((match = catRegex.exec(menuContent)) !== null) {
    const catId = match[1];
    const catTitle = match[2];
    const itemsBlock = match[3];

    // Find each item in itemsBlock
    const itemRegex = /\{[^}]*?id:\s*'([^']+)'[^}]*?name:\s*'([^']+)'[^}]*?\}/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(itemsBlock)) !== null) {
      const fullItemStr = itemMatch[0];
      const itemId = itemMatch[1];
      const itemName = itemMatch[2];

      const slug = toSlug(itemName);
      const filename = `${slug}.jpg`;
      const destPath = path.join(FOOD_DIR, filename);

      const baseKey = getBaseImageForDish(itemName, catId);
      const sourcePath = path.join(FOOD_DIR, `${baseKey}.jpg`);

      if (!fs.existsSync(sourcePath)) {
        console.warn(`Source base image missing: ${sourcePath}`);
      } else {
        // Copy base image to the food item named file
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(sourcePath, destPath);
          createdCount++;
        }
      }

      // Prepare replacement for item definition with local image
      const localImagePath = `./images/food/${filename}`;
      let newItemStr = fullItemStr;

      // Replace existing image property or add image property
      if (/image:\s*'[^']+'/.test(newItemStr)) {
        newItemStr = newItemStr.replace(/image:\s*'[^']+'/, `image: '${localImagePath}'`);
      } else {
        // insert before closing brace
        newItemStr = newItemStr.replace(/\s*\}\s*$/, `, image: '${localImagePath}' }`);
      }

      itemReplacements.push({
        from: fullItemStr,
        to: newItemStr,
      });
    }
  }

  console.log(`Created ${createdCount} food item image files in ${FOOD_DIR}`);

  // Apply item replacements
  for (const { from, to } of itemReplacements) {
    menuContent = menuContent.replace(from, to);
  }

  // Update category hero images to local files
  for (const [catId, heroKey] of Object.entries(CATEGORY_HERO_MAP)) {
    const heroRegex = new RegExp(`id:\\s*'${catId}'[\\s\\S]*?heroImage:\\s*'[^']+'`, 'g');
    menuContent = menuContent.replace(heroRegex, (matched) => {
      return matched.replace(/heroImage:\s*'[^']+'/, `heroImage: './images/food/${heroKey}.jpg'`);
    });
  }

  fs.writeFileSync(menuDataPath, menuContent, 'utf8');
  console.log('Successfully updated src/data/menuData.ts with local food image paths!');

  // Update hotelData.ts dining venue images to local files
  let hotelContent = fs.readFileSync(hotelDataPath, 'utf8');
  hotelContent = hotelContent.replace(
    /heroImage:\s*'https:\/\/images\.unsplash\.com\/photo-1517248135467-4c7edcad34c4[^']*'/,
    `heroImage: './images/food/venue-restaurant.jpg'`
  );
  hotelContent = hotelContent.replace(
    /heroImage:\s*'https:\/\/images\.unsplash\.com\/photo-1519167758481-83f550bb49b3[^']*'/,
    `heroImage: './images/food/venue-banquet.jpg'`
  );
  fs.writeFileSync(hotelDataPath, hotelContent, 'utf8');
  console.log('Successfully updated src/data/hotelData.ts with local venue image paths!');
}

run();
