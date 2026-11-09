import type { ButtonHTMLAttributes } from 'react';

const buttonClasses = {
  primary: 'add-button',
  secondary: 'secondary-button',
  text: 'text-button',
  ghost: 'ghost-button',
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonClasses }) {
  return <button type={type} className={`${buttonClasses[variant]} ${className}`} {...props} />;
}
