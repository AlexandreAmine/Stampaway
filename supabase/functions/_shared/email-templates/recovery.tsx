/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  token: string
}

export const RecoveryEmail = ({
  siteName,
  token,
}: RecoveryEmailProps) => {
  const displayToken = token?.trim() || '••••••'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your 6-digit password reset code for {siteName}: {displayToken}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>{siteName}</Text>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>
            Use this 6-digit code to reset your password. Enter it in the app to continue.
          </Text>
          <Text style={codeStyle}>{displayToken}</Text>
          <Text style={helperText}>
            This code expires shortly. If you didn't request a password reset,
            you can safely ignore this email and your password will stay the same.
          </Text>
          <Text style={footer}>
            For your security, only enter this code inside {siteName}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default RecoveryEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  padding: '24px 12px',
}

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 28px',
  border: '1px solid hsl(0, 0%, 90%)',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
}

const eyebrow = {
  fontSize: '12px',
  lineHeight: '1.4',
  fontWeight: '700' as const,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'hsl(217, 91%, 60%)',
  margin: '0 0 12px',
}

const h1 = {
  fontSize: '28px',
  lineHeight: '1.2',
  fontWeight: '700' as const,
  color: 'hsl(0, 0%, 4%)',
  margin: '0 0 16px',
}

const text = {
  fontSize: '15px',
  color: 'hsl(0, 0%, 18%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}

const codeStyle = {
  fontFamily: "'SFMono-Regular', 'Roboto Mono', 'Courier New', monospace",
  fontSize: '32px',
  fontWeight: '700' as const,
  letterSpacing: '0.28em',
  textAlign: 'center' as const,
  color: 'hsl(217, 91%, 35%)',
  backgroundColor: 'hsl(217, 91%, 96%)',
  border: '1px solid hsl(217, 91%, 85%)',
  borderRadius: '12px',
  padding: '18px 20px',
  margin: '0 0 20px',
}

const helperText = {
  fontSize: '14px',
  color: 'hsl(0, 0%, 40%)',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const footer = {
  fontSize: '12px',
  color: 'hsl(0, 0%, 52%)',
  lineHeight: '1.6',
  margin: '0',
}
