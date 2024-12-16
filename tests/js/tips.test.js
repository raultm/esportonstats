import { describe, it, expect } from 'vitest';
import { getTips } from '../../src/js/tips';

describe('Tips Module', () => {
    it('debe devolver un array de categorías con preguntas', () => {
        const categories = getTips();

        // Verifica que es un array y contiene al menos una categoría
        expect(Array.isArray(categories)).toBe(true);
        expect(categories.length).toBeGreaterThan(0);

        categories.forEach(({ category, tips }) => {
            // Cada categoría debe tener un título
            expect(typeof category).toBe('string');
            expect(category.length).toBeGreaterThan(0);

            // Cada categoría debe tener un array de tips
            expect(Array.isArray(tips)).toBe(true);
            expect(tips.length).toBeGreaterThan(0);

            // Cada tip debe ser un string con contenido
            tips.forEach(tip => {
                expect(typeof tip).toBe('string');
                expect(tip.length).toBeGreaterThan(0);
            });
        });
    });

    it('debe incluir una categoría llamada "Definición del Proyecto"', () => {
        const categories = getTips();
        const categoryTitles = categories.map(({ category }) => category);
        expect(categoryTitles).toContain('Definición del Proyecto');
    });
});
