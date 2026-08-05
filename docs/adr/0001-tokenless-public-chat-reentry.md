# Reingreso al chat mediante token, sin login

## Status

accepted

## Contexto y decisión

El chat es un link público sin autenticación (requisito del MVP: los padres/cuidadores no deben
crear cuenta). Aun así, una conversación puede quedar abierta para que una enfermera responda por el
mismo canal, por lo que el usuario debe poder volver a ella. Decidimos identificar cada conversación
con un **token secreto no adivinable** (`crypto.randomUUID`, 122 bits) que vive en la URL
(`/c/<token>`) y se guarda en `localStorage` para reingreso automático en el mismo dispositivo. El
token *es* la credencial de acceso a esa conversación: quien lo tenga, la ve.

## Considered Options

- **Login para usuarios del chat** — descartado: contradice el requisito de acceso público sin fricción.
- **Solo `localStorage`** — descartado: no es recuperable ni compartible si el usuario cambia de
  dispositivo o limpia el navegador.
- **Código corto que el usuario copia** — descartado: más fricción y un espacio de códigos pequeño y
  adivinable.

## Consequences

- No hay forma de "recuperar" una conversación si el usuario pierde el link y borra su `localStorage`:
  el token es la única llave. Es una decisión consciente, aceptable para el bajo riesgo del MVP
  (los datos son solo nombre/RUT, sin diagnóstico).
- Las lecturas anónimas de una conversación pasan por una route de servidor validada por token
  (`/api/conversations/[token]`), nunca exponiendo la service-role key al navegador.
- Verificación de identidad: al ser público, cualquiera podría ingresar un RUT ajeno. Riesgo bajo
  para este alcance; documentado como pendiente en los requisitos.
