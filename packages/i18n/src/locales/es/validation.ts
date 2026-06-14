export const validation = {
  required: 'Este campo es obligatorio.',
  displayNameRequired: 'El nombre visible es obligatorio.',
  titleRequired: 'El título es obligatorio.',
  descriptionRequired: 'La descripción es obligatoria.',
  needTitleTooShort: 'Añade un título claro para la necesidad.',
  offerTitleTooShort: 'Añade un título claro para la oferta.',
  needDescriptionTooShort: 'Describe la necesidad con al menos un detalle útil.',
  offerDescriptionTooShort: 'Describe la oferta con al menos un detalle útil.',
  titleTooLong: 'El título debe tener {{max}} caracteres o menos.',
  descriptionTooLong: 'La descripción debe tener {{max}} caracteres o menos.',
  modeRequired: 'Elige cómo se puede realizar este intercambio.',
} as const;
