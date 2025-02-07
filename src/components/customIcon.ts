const iconPath = 'assets/img/customIcons/';
const CustomIcons = [
  'like'
] as const;

export type CustomIconType = typeof CustomIcons[number];

export function getCustomIconPath(iconName: CustomIconType) {
  if(!CustomIcons.includes(iconName)) {
    return;
  }

  return `${iconPath}${iconName}.svg`;
}

const renderCustomIcon = async(icon?: CustomIconType) => {
  const span = document.createElement('span');

  const iconUrl = getCustomIconPath(icon);
  if(!iconUrl) return span;

  try {
    const response = await fetch(iconUrl);
    const svgText = await response.text();

    span.innerHTML = svgText;
  } catch(error) {
    console.error('SVG loading error:', error);
  }

  return span;
};

export default renderCustomIcon;
