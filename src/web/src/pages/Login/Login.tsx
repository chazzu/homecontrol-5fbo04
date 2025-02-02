import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.0.0
import styled from 'styled-components'; // v6.0.0
import { useAuthContext } from '../../contexts/AuthContext';
import Button from '../../components/common/Button/Button';
import Input from '../../components/common/Input/Input';
import { ButtonVariant, ButtonSize } from '../../components/common/Button/Button.types';
import { InputSize, InputVariant } from '../../components/common/Input/Input.types';

// Rate limiting constants
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_DURATION = 300000; // 5 minutes

// Styled components with theme integration
const StyledLoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  background-color: ${({ theme }) => theme.colors.background};

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const StyledLoginForm = styled.form`
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const StyledTitle = styled.h1`
  text-align: center;
  margin-bottom: 2rem;
  color: ${({ theme }) => theme.colors.text};
  font-size: 1.5rem;
  font-weight: 600;
`;

const StyledError = styled.div`
  color: ${({ theme }) => theme.colors.error};
  margin-top: 1rem;
  font-size: 0.875rem;
  text-align: center;
  role: alert;
`;

const Login: React.FC = () => {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);
  const { login } = useAuthContext();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  // Check rate limiting status
  const isRateLimited = useCallback(() => {
    const now = Date.now();
    if (now - lastAttemptTime > RATE_LIMIT_DURATION) {
      setLoginAttempts(0);
      return false;
    }
    return loginAttempts >= MAX_LOGIN_ATTEMPTS;
  }, [loginAttempts, lastAttemptTime]);

  // Token validation
  const validateToken = useCallback((token: string): boolean => {
    const tokenRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    return token.length >= 32 && tokenRegex.test(token);
  }, []);

  // Handle token input changes
  const handleTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setToken(e.target.value);
    setError(null);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Check rate limiting
    if (isRateLimited()) {
      setError(`Too many login attempts. Please try again in ${RATE_LIMIT_DURATION / 60000} minutes.`);
      return;
    }

    // Validate token format
    if (!validateToken(token)) {
      setError('Invalid token format. Please check your Home Assistant long-lived access token.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(token);
      navigate('/dashboard');
    } catch (error) {
      setLoginAttempts(prev => prev + 1);
      setLastAttemptTime(Date.now());
      setError(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [token, login, navigate, isRateLimited, validateToken]);

  // Reset form on unmount
  useEffect(() => {
    return () => {
      setToken('');
      setError(null);
      setIsLoading(false);
    };
  }, []);

  return (
    <StyledLoginContainer>
      <StyledLoginForm
        ref={formRef}
        onSubmit={handleSubmit}
        aria-labelledby="login-title"
        noValidate
      >
        <StyledTitle id="login-title">Smart Home Dashboard Login</StyledTitle>
        
        <Input
          id="token-input"
          name="token"
          type="password"
          value={token}
          onChange={handleTokenChange}
          label="Home Assistant Token"
          placeholder="Enter your long-lived access token"
          error={error || undefined}
          disabled={isLoading || isRateLimited()}
          required
          size={InputSize.LARGE}
          variant={InputVariant.OUTLINED}
          aria-label="Home Assistant access token"
          aria-invalid={!!error}
          aria-describedby={error ? "login-error" : undefined}
        />

        <Button
          type="submit"
          variant={ButtonVariant.PRIMARY}
          size={ButtonSize.LARGE}
          disabled={isLoading || isRateLimited() || !token}
          fullWidth
          aria-label="Log in to Smart Home Dashboard"
        >
          {isLoading ? 'Logging in...' : 'Log In'}
        </Button>

        {error && (
          <StyledError id="login-error" role="alert">
            {error}
          </StyledError>
        )}
      </StyledLoginForm>
    </StyledLoginContainer>
  );
};

export default Login;