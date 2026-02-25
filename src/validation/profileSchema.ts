import * as yup from 'yup';

export interface ProfileFormData {
  firstName: string;
  lastName: string;
}

export const profileSchema = yup.object({
  firstName: yup
    .string()
    .trim()
    .required('validation.firstNameRequired')
    .min(2, 'validation.firstNameMin'),
  lastName: yup
    .string()
    .trim()
    .required('validation.lastNameRequired')
    .min(2, 'validation.lastNameMin'),
});
