# WhatsApp Business · respuestas automáticas para pedidos

Número de prueba: **+52 220 625 7291**. Todo esto se configura en la app **WhatsApp Business**
(Ajustes → Herramientas para la empresa). No requiere programar ni pagar.

Cómo encaja con el sitio:

1. La clienta arma su carrito y toca **Apartar por WhatsApp**. Llega un mensaje que empieza así:
   `¡Hola! Quiero apartar este pedido 🛍️ / Pedido BS-XXXX`.
2. La **bienvenida** o la **ausencia** contestan solas al instante.
3. La dueña abre el enlace "Para la tienda" del mensaje → ve el pedido en el panel → en
   **Mensajes para la clienta** toca **Enviar…** y elige el chat. Ese mensaje ya trae código, piezas, total y fecha.
4. Para lo demás usa las **respuestas rápidas** (escribe `/` en el chat).
5. Con **etiquetas** ve de un vistazo en qué va cada pedido.

> Antes de usarlo: cambia **[HORARIO]** y **[FORMAS DE PAGO]** por los datos reales.

---

## 1. Mensaje de bienvenida

Herramientas → **Mensaje de bienvenida** → activar. Destinatarios: *Todos*.
Se envía a quien escribe por primera vez o tras 14 días sin escribir.

```
¡Hola! 💜 Gracias por escribir a BAG STORE SF.

🛍️ Si nos mandaste un pedido (empieza con BS-), ya quedó registrado: en un momento te confirmamos que todo esté disponible.
👜 Catálogo: https://bagstoresf.vercel.app
📍 Calle Altamirano #132, San Felipe, Gto. · [HORARIO]
```

## 2. Mensaje de ausencia

Herramientas → **Mensaje de ausencia** → activar → *Enviar fuera del horario comercial*
(primero define el horario en Perfil de la empresa).

```
¡Hola! 💜 En este momento estamos cerradas.

Si mandaste un pedido BS-, ya quedó guardado: te lo apartamos 7 días y mañana te confirmamos a primera hora.
Horario: [HORARIO] · Catálogo: https://bagstoresf.vercel.app
```

## 3. Respuestas rápidas

Herramientas → **Respuestas rápidas** → *Agregar*. En el chat se usan escribiendo `/` y el atajo.
Los mensajes de cada pedido (con código y total) salen del panel; estas son para todo lo demás.

| Atajo | Mensaje |
| --- | --- |
| `/confirmado` | ¡Listo! 💜 Tu pedido está confirmado. Te lo guardamos 7 días. Al llegar muestra tu código o el QR y pagas en tienda. 📍 Calle Altamirano #132, San Felipe, Gto. |
| `/agotado` | Una disculpa 🙏 esa pieza ya se vendió. ¿Te mando opciones parecidas? Mira lo disponible aquí: https://bagstoresf.vercel.app |
| `/apartar` | Para apartar: abre https://bagstoresf.vercel.app, toca "Agregar al carrito" en las piezas que te gusten y luego "Apartar por WhatsApp". Te llega un código para pagar en tienda. 🛍️ |
| `/ubicacion` | 📍 Calle Altamirano #132, San Felipe, Gto. https://www.google.com/maps/search/?api=1&query=Calle+Altamirano+132+San+Felipe+Guanajuato |
| `/horario` | Te esperamos [HORARIO]. 💜 |
| `/pago` | Pagas al recoger en tienda: [FORMAS DE PAGO]. No pedimos pagos por adelantado. |
| `/recordatorio` | ¡Hola! 💜 Te recordamos que tu pedido te espera en tienda. ¿Cuándo pasas por él? |
| `/gracias` | ¡Gracias por tu compra! 🛍️ Nos encantará verte de nuevo. Lo nuevo siempre está en https://bagstoresf.vercel.app |
| `/envio` | Por ahora las entregas son en tienda. Si no puedes venir, escríbenos y vemos opciones. 💜 |

## 4. Etiquetas

Chats → mantener presionado un chat → **Etiquetar**. Crea estas cuatro:

| Etiqueta | Cuándo |
| --- | --- |
| 🟣 Pedido nuevo | Llegó un mensaje con código BS- |
| 🟢 Confirmado | Ya le mandaste "Confirmar pedido" |
| ✅ Pagado | La dueña tocó "Pagado y entregado" en el panel |
| ⚪ Vencido / cancelado | Pasaron 7 días o se canceló |

## 5. Perfil de la empresa

Ajustes → **Perfil de la empresa**: categoría *Tienda de ropa y accesorios*, dirección, **horario** (lo usa el
mensaje de ausencia) y sitio web `https://bagstoresf.vercel.app`.

## Rutina sugerida

- **Al llegar un pedido:** etiqueta *Pedido nuevo* → abre el enlace "Para la tienda" → **Confirmar pedido**
  (o **Avisar que algo se agotó**) → etiqueta *Confirmado*.
- **Una vez al día:** en el panel, Pedidos → *Por cobrar*. A los que llevan días, **Recordatorio**.
- **En mostrador:** escanea el QR o busca el código → **Pagado y entregado** → **Gracias por tu compra** → etiqueta *Pagado*.

---

## Siguiente nivel: bot con la API oficial (cuando haga falta)

Con la **WhatsApp Cloud API de Meta** y una función en Supabase, el bot podría contestar solo al recibir
`Pedido BS-XXXX` con el estado real del pedido, mandar el recordatorio un día antes de vencer y avisar
"¡Gracias por tu compra!" en cuanto la dueña cobra. El sistema ya está listo para eso: el código tiene
formato fijo y cada pedido guarda la fecha de creación, cobro y cancelación.

Lo que haría falta antes de programarlo:

- Cuenta de **Meta Business** verificada y una app en developers.facebook.com con WhatsApp.
- Decidir el número: Meta da uno de prueba gratis para desarrollar. Para usar el de la tienda con la API, hay
  que confirmar si en México se permite seguir usándolo en la app WhatsApp Business al mismo tiempo ("coexistencia").
- Los mensajes que inicia la tienda (recordatorios, avisos) se envían con plantillas aprobadas por Meta y tienen costo por mensaje.
