import { en } from './en';
import { mr } from './mr';
import type { Translations } from './en';

type LeafKeyOf<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? `${K}`
        : T[K] extends Record<string, any>
          ? `${K}.${LeafKeyOf<T[K]>}`
          : never;
    }[keyof T & string];

export type TranslationKey = LeafKeyOf<Translations>;

function getNestedValue(obj: unknown, path: string): string {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return '';
    current = current[part];
  }
  return typeof current === 'string' ? current : '';
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return key in params ? String(params[key]) : `{${key}}`;
  });
}

/**
 * Pure function that takes a dotted key path into the translations
 * and returns `${en} / ${mr}`.
 * Optional params can be provided to interpolate `{param}` tokens.
 */
export function bilingual(
  path: TranslationKey,
  params?: Record<string, string | number>
): string {
  const enTemplate = getNestedValue(en, path);
  const mrTemplate = getNestedValue(mr, path);

  const enText = interpolate(enTemplate, params);
  const mrText = interpolate(mrTemplate, params);

  return `${enText} / ${mrText}`;
}
