/**
 * Validates password strength
 * Rules:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const validatePassword = (password) => {
  const minLength = 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return { isValid: false, message: `Password must be at least ${minLength} characters long.` };
  }
  if (!hasUppercase) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!hasLowercase) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!hasNumber) {
    return { isValid: false, message: 'Password must contain at least one number.' };
  }
  if (!hasSpecialChar) {
    return { isValid: false, message: 'Password must contain at least one special character.' };
  }

  return { isValid: true };
};

module.exports = { validatePassword };
