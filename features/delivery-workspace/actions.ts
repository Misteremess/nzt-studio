"use server";
// features/delivery-workspace/actions.ts
// Server Actions for the Delivery Workspace. Pure post-sale tracking: start a
// delivery for a shipped MVP spec, advance its status, edit metadata and manage
// its checklist. No AI involved.

import { revalidatePath } from "next/cache";

import {
  addDeliveryTask,
  deleteDeliveryTask,
  getDeliveryBoard,
  setDeliveryStatus,
  setDeliveryTaskDone,
  startDelivery,
  updateDeliveryMeta,
} from "@/features/delivery-workspace/lib/store";
import type { DeliveryBoard, DeliveryStatus } from "@/features/delivery-workspace/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

const DELIVERY_STATUSES: DeliveryStatus[] = [
  "QUEUED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DELIVERED",
  "ON_HOLD",
  "CANCELLED",
];

function isStatus(value: string): value is DeliveryStatus {
  return (DELIVERY_STATUSES as string[]).includes(value);
}

function refresh() {
  revalidatePath("/delivery-workspace");
}

/** Returns the full delivery board (active deliveries + available specs + stats). */
export async function getDeliveryBoardAction(): Promise<ActionResult<DeliveryBoard>> {
  try {
    const data = await getDeliveryBoard();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Error al cargar las entregas.", errorCode: "DB_ERROR" };
  }
}

/** Starts tracking a delivery for a given MVP spec. */
export async function startDeliveryAction(
  mvpSpecId: string
): Promise<ActionResult<DeliveryBoard>> {
  if (!mvpSpecId || typeof mvpSpecId !== "string") {
    return { ok: false, error: "Especificación no válida.", errorCode: "INVALID_INPUT" };
  }
  try {
    await startDelivery(mvpSpecId);
    refresh();
    const data = await getDeliveryBoard();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudo iniciar la entrega.", errorCode: "DB_ERROR" };
  }
}

/** Advances a delivery to a new lifecycle status. */
export async function setDeliveryStatusAction(
  deliveryId: string,
  status: string
): Promise<ActionResult<{ id: string; status: DeliveryStatus }>> {
  if (!deliveryId || !isStatus(status)) {
    return { ok: false, error: "Estado no válido.", errorCode: "INVALID_INPUT" };
  }
  try {
    await setDeliveryStatus(deliveryId, status);
    refresh();
    return { ok: true, data: { id: deliveryId, status } };
  } catch {
    return { ok: false, error: "No se pudo actualizar el estado.", errorCode: "DB_ERROR" };
  }
}

/** Saves repo URL, deploy URL and notes for a delivery. */
export async function updateDeliveryMetaAction(
  deliveryId: string,
  meta: { repoUrl?: string | null; deployUrl?: string | null; notes?: string | null }
): Promise<ActionResult<{ id: string }>> {
  if (!deliveryId) {
    return { ok: false, error: "Entrega no válida.", errorCode: "INVALID_INPUT" };
  }
  const clean = (v: string | null | undefined) => {
    if (v == null) return null;
    const t = v.trim();
    return t === "" ? null : t;
  };
  try {
    await updateDeliveryMeta(deliveryId, {
      ...(meta.repoUrl !== undefined ? { repoUrl: clean(meta.repoUrl) } : {}),
      ...(meta.deployUrl !== undefined ? { deployUrl: clean(meta.deployUrl) } : {}),
      ...(meta.notes !== undefined ? { notes: clean(meta.notes) } : {}),
    });
    refresh();
    return { ok: true, data: { id: deliveryId } };
  } catch {
    return { ok: false, error: "No se pudieron guardar los cambios.", errorCode: "DB_ERROR" };
  }
}

/** Adds a checklist task to a delivery. */
export async function addDeliveryTaskAction(
  deliveryId: string,
  title: string
): Promise<ActionResult<DeliveryBoard>> {
  const t = title?.trim();
  if (!deliveryId || !t) {
    return { ok: false, error: "Tarea no válida.", errorCode: "INVALID_INPUT" };
  }
  try {
    await addDeliveryTask(deliveryId, t.slice(0, 200));
    refresh();
    const data = await getDeliveryBoard();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudo añadir la tarea.", errorCode: "DB_ERROR" };
  }
}

/** Toggles a checklist task's completion. */
export async function setDeliveryTaskDoneAction(
  taskId: string,
  done: boolean
): Promise<ActionResult<{ id: string; done: boolean }>> {
  if (!taskId) {
    return { ok: false, error: "Tarea no válida.", errorCode: "INVALID_INPUT" };
  }
  try {
    await setDeliveryTaskDone(taskId, done);
    refresh();
    return { ok: true, data: { id: taskId, done } };
  } catch {
    return { ok: false, error: "No se pudo actualizar la tarea.", errorCode: "DB_ERROR" };
  }
}

/** Removes a checklist task. */
export async function deleteDeliveryTaskAction(
  taskId: string
): Promise<ActionResult<{ id: string }>> {
  if (!taskId) {
    return { ok: false, error: "Tarea no válida.", errorCode: "INVALID_INPUT" };
  }
  try {
    await deleteDeliveryTask(taskId);
    refresh();
    return { ok: true, data: { id: taskId } };
  } catch {
    return { ok: false, error: "No se pudo eliminar la tarea.", errorCode: "DB_ERROR" };
  }
}
