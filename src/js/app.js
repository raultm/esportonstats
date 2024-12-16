import { getTips } from './tips.js';

document.addEventListener('DOMContentLoaded', () => {
    const tipsContainer = document.getElementById('tips-container');
    const tips = getTips();

    tips.forEach(({ category, tips }) => {
        const card = document.createElement('div');
        card.className = 'card';

        const title = document.createElement('h2');
        title.textContent = category;
        card.appendChild(title);

        const list = document.createElement('ul');
        tips.forEach(tip => {
            const listItem = document.createElement('li');
            listItem.textContent = tip;
            list.appendChild(listItem);
        });
        card.appendChild(list);

        tipsContainer.appendChild(card);
    });
});
