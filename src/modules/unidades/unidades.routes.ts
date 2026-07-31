import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

export const unidadesRouter = Router();
unidadesRouter.use(requireAuth);

const tipos = ['Peso', 'Volumen', 'Unidad'] as const;
const crearSchema = z.object({
  nombre: z.string().min(1).max(60),
  abreviatura: z.string().min(1).max(10),
  tipo: z.enum(tipos),
});
const editarSchema = crearSchema.partial();

const dto = (u: { id: string; nombre: string; abreviatura: string; tipo: string }) => ({
  id: u.id,
  nombre: u.nombre,
  abreviatura: u.abreviatura,
  tipo: u.tipo,
});

/** GET /unidades — catálogo global de unidades de medida. */
unidadesRouter.get(
  '/',
  ah(async (_req, res) => {
    const unidades = await prisma.unidadMedida.findMany({ orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }] });
    res.json(unidades.map(dto));
  }),
);

unidadesRouter.post(
  '/',
  ah(async (req, res) => {
    const d = crearSchema.parse(req.body);
    const existe = await prisma.unidadMedida.findUnique({ where: { abreviatura: d.abreviatura } });
    if (existe) return res.status(409).json({ error: 'Ya existe una unidad con esa abreviatura' });
    const u = await prisma.unidadMedida.create({ data: d });
    res.status(201).json(dto(u));
  }),
);

unidadesRouter.patch(
  '/:id',
  ah(async (req, res) => {
    const d = editarSchema.parse(req.body);
    const existe = await prisma.unidadMedida.findUnique({ where: { id: req.params.id } });
    if (!existe) return res.status(404).json({ error: 'Unidad no encontrada' });

    if (d.abreviatura && d.abreviatura !== existe.abreviatura) {
      const dup = await prisma.unidadMedida.findUnique({ where: { abreviatura: d.abreviatura } });
      if (dup) return res.status(409).json({ error: 'Ya existe una unidad con esa abreviatura' });
    }
    const u = await prisma.unidadMedida.update({ where: { id: req.params.id }, data: d });
    res.json(dto(u));
  }),
);

unidadesRouter.delete(
  '/:id',
  ah(async (req, res) => {
    const existe = await prisma.unidadMedida.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { insumos: true } } },
    });
    if (!existe) return res.status(404).json({ error: 'Unidad no encontrada' });
    if (existe._count.insumos > 0) return res.status(409).json({ error: 'La unidad está en uso por insumos' });
    await prisma.unidadMedida.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
