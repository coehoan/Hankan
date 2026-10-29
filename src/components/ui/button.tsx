import type { ButtonHTMLAttributes } from 'react';
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'text' }) {
  return (
    <button
      type={type}
      className={`${variant === 'primary' ? 'add-button' : variant === 'secondary' ? 'secondary-button' : 'text-button'} ${className}`}
      {...props}
    />
  );
}
