import { prisma } from '$lib/server/prisma.js';
import { fail } from '@sveltejs/kit';
import { parseClienteForm } from '$lib/schemas/cliente.js';

// ─────────────────────────────────────────────
// LOAD
// ─────────────────────────────────────────────
/** @type {import('./$types').PageServerLoad} */
export async function load() {
  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nombre: true,
      empresa: true,
      rfc: true,
      email: true,
      telefono: true,
      createdAt: true,
    }
  });

  return { clientes };
}

// ─────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────
/** @type {import('./$types').Actions} */
export const actions = {

  // ── CREAR ──────────────────────────────────
  crear: async ({ request }) => {
    const formData = await request.formData();
    const { data, errors, values } = parseClienteForm(formData);

    if (errors) {
      return fail(400, { errors, values, action: 'crear' });
    }

    // Verificar email duplicado
    const existe = await prisma.cliente.findUnique({ where: { email: data.email } });
    if (existe) {
      return fail(400, {
        errors: { email: 'Ya existe un cliente con este correo' },
        values,
        action: 'crear'
      });
    }

    await prisma.cliente.create({
      data: {
        nombre:    data.nombre,
        empresa:   data.empresa   || null,
        rfc:       data.rfc       || null,
        email:     data.email,
        telefono:  data.telefono  || null,
        direccion: data.direccion || null,
        notas:     data.notas     || null,
      }
    });

    return { success: true, flash: `Cliente "${data.nombre}" creado correctamente.`, action: 'crear' };
  },

  // ── EDITAR ─────────────────────────────────
  editar: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id')?.toString();

    if (!id) return fail(400, { errors: { _form: 'ID de cliente requerido' }, action: 'editar' });

    // Verificar que el cliente exista y esté activo
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente || !cliente.activo) {
      return fail(404, { errors: { _form: 'Cliente no encontrado o inactivo' }, action: 'editar' });
    }

    const { data, errors, values } = parseClienteForm(formData);
    if (errors) {
      return fail(400, { errors, values, action: 'editar', editId: id });
    }

    // Verificar email duplicado en OTRO cliente
    const emailEnUso = await prisma.cliente.findFirst({
      where: { email: data.email, NOT: { id } }
    });
    if (emailEnUso) {
      return fail(400, {
        errors: { email: 'Ya existe otro cliente con este correo' },
        values,
        action: 'editar',
        editId: id
      });
    }

    await prisma.cliente.update({
      where: { id },
      data: {
        nombre:    data.nombre,
        empresa:   data.empresa   || null,
        rfc:       data.rfc       || null,
        email:     data.email,
        telefono:  data.telefono  || null,
        direccion: data.direccion || null,
        notas:     data.notas     || null,
      }
    });

    return { success: true, flash: `Cliente "${data.nombre}" actualizado.`, action: 'editar' };
  },
};
