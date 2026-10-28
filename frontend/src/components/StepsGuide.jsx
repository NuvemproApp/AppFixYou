import React from 'react';
import { Box, Text, Link } from '@nimbus-ds/components';

// Passo-a-passo numerado (onboarding). Cada passo: número em círculo + título +
// descrição + CTA opcional. Usado no Dashboard para ensinar o fluxo do app.
export default function StepsGuide({ steps }) {
  return (
    <Box display="flex" flexDirection="column" gap="5">
      {steps.map((step, i) => (
        <Box key={i} display="flex" gap="3" alignItems="flex-start">
          <Box
            flexShrink="0"
            width="32px"
            height="32px"
            borderRadius="full"
            backgroundColor="primary-surface"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontWeight="bold" color="primary-interactive">{i + 1}</Text>
          </Box>
          <Box display="flex" flexDirection="column" gap="1" paddingTop="1">
            <Text fontWeight="bold">{step.title}</Text>
            <Text color="neutral-textLow">{step.description}</Text>
            {step.actionLabel && step.onAction && (
              <Box paddingTop="1">
                <Link as="button" appearance="primary" onClick={step.onAction}>
                  {step.actionLabel}
                </Link>
              </Box>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
