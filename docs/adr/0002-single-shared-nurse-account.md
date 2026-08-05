# Cuenta única compartida para la enfermera

## Status

accepted

## Contexto y decisión

La operación del MVP contempla **una sola enfermera** y una **bandeja común de avisos** (sin
asignación individual ni SLA, según requisitos). Decidimos autenticar el dashboard con **Supabase
Auth usando una única cuenta compartida** (email + contraseña, creada manualmente en el panel), en
lugar de cuentas por usuario. Las políticas RLS otorgan acceso de lectura/escritura al rol
`authenticated` sobre los datos de personal (conversaciones, mensajes, avisos).

## Considered Options

- **Cuentas por enfermera** — descartado por ahora: no hay a quién distinguir; agrega gestión de
  usuarios sin beneficio en el MVP.
- **URL oscura sin autenticación** — descartado: el dashboard expone nombre/RUT de pacientes; requiere
  autenticación real.

## Consequences

- No hay trazabilidad de *quién* resolvió o reclasificó un aviso: todas las acciones son de "la
  enfermera". Cuando entren varias enfermeras habrá que migrar a cuentas por usuario y, si se quiere
  atribución histórica, agregar un `nurse_id` a avisos/acciones.
- Es reversible con costo acotado: Supabase Auth ya está en uso; migrar a multiusuario es agregar
  usuarios y, opcionalmente, afinar RLS. Se registra aquí porque el código asume "un solo rol de
  personal" y un lector futuro podría asumir lo contrario.
