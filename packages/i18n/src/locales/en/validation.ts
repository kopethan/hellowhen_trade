export const validation = {
  required: 'This field is required.',
  displayNameRequired: 'Display name is required.',
  titleRequired: 'Title is required.',
  descriptionRequired: 'Description is required.',
  needTitleTooShort: 'Add a clear need title.',
  offerTitleTooShort: 'Add a clear offer title.',
  needDescriptionTooShort: 'Describe the need with at least one useful detail.',
  offerDescriptionTooShort: 'Describe the offer with at least one useful detail.',
  titleTooLong: 'Title must be {{max}} characters or less.',
  descriptionTooLong: 'Description must be {{max}} characters or less.',
  modeRequired: 'Choose how this can be exchanged.',
} as const;
