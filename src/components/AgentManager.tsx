import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import type { Agent, Department } from "../types";
import { useI18n } from "../i18n";
import * as api from "../api";
import { buildSpriteMap } from "./AgentAvatar";
import AgentFormModal from "./agent-manager/AgentFormModal";
import AgentsTab from "./agent-manager/AgentsTab";
import { BLANK, ICON_SPRITE_POOL } from "./agent-manager/constants";
import DepartmentFormModal from "./agent-manager/DepartmentFormModal";
import DepartmentsTab from "./agent-manager/DepartmentsTab";
import { StackedSpriteIcon } from "./agent-manager/EmojiPicker";
import type { AgentManagerProps, FormData } from "./agent-manager/types";
import { pickRandomSpritePair } from "./agent-manager/utils";

export default function AgentManager({ agents, departments, onAgentsChange }: AgentManagerProps) {
  const { t, locale } = useI18n();
  const isKo = locale.startsWith("ko");
  const esMap: Record<string, string> = {
    "Agent Manager": "Gestor de agentes",
    "Add Dept": "Agregar depto",
    "Hire Agent": "Contratar agente",
    Agents: "Agentes",
    Departments: "Departamentos",
    Total: "Total",
    Working: "En trabajo",
    All: "Todos",
    "Double-click: edit dept": "Doble clic: editar depto",
    Search: "Buscar",
    "No agents found": "No se encontraron agentes",
    "Order has been changed.": "El orden ha cambiado.",
    "Saving...": "Guardando...",
    "Save Order": "Guardar orden",
    Cancel: "Cancelar",
    agents: "agentes",
    Edit: "Editar",
    "No departments found.": "No se encontraron departamentos.",
    "Department ID already exists.": "El ID del departamento ya existe.",
    "Cannot delete: department has agents.": "No se puede eliminar: el departamento tiene agentes.",
    "Cannot delete: department has tasks.": "No se puede eliminar: el departamento tiene tareas.",
    "Cannot delete: protected system department.": "No se puede eliminar: departamento del sistema protegido.",
    "Edit Department": "Editar departamento",
    "Add Department": "Agregar departamento",
    Icon: "Icono",
    Name: "Nombre",
    "Theme Color": "Color del tema",
    "Korean Name": "Nombre coreano",
    Description: "Descripción",
    "Brief description of the department": "Descripción breve del departamento",
    "Department Prompt": "Prompt del departamento",
    "Shared system prompt for agents in this department...": "Prompt del sistema compartido para los agentes de este departamento...",
    "Applied as shared system prompt when agents in this department execute tasks": "Se aplica como prompt del sistema compartido cuando los agentes de este departamento ejecutan tareas",
    "Save Changes": "Guardar cambios",
    Confirm: "Confirmar",
    No: "No",
    Delete: "Eliminar",
    "Edit Agent": "Editar agente",
    "Hire New Agent": "Contratar nuevo agente",
    "Basic Info": "Información básica",
    Emoji: "Emoji",
    Department: "Departamento",
    "— Unassigned —": "— Sin asignar —",
    "Role Config": "Configuración de rol",
    Role: "Rol",
    "CLI Provider": "Proveedor CLI",
    "Personality / Prompt": "Personalidad / Prompt",
    "Expertise or personality...": "Especialidad o personalidad...",
    "Character Sprite": "Sprite del personaje",
    "Upload 4-direction sprite sheet (2x2 grid)": "Subir hoja de sprite en 4 direcciones (cuadrícula 2x2)",
    "Front / Left / Back / Right order": "Orden Frente / Izquierda / Atrás / Derecha",
    "Removing background & splitting...": "Quitando fondo y separando...",
    Front: "Frente",
    Left: "Izquierda",
    Right: "Derecha",
    "Sprite #": "Sprite #",
    Registering: "Registrando",
    "Registering...": "Registrando...",
    "Registered!": "¡Registrado!",
    "Register Sprite": "Registrar sprite",
    "Re-upload": "Subir de nuevo",
    "Confirm Hire": "Confirmar contratación",
    Fire: "Despedir",
  };
  const tr = (ko: string, en: string, es?: string) => t({ ko, en, ja: en, zh: en, es: es ?? esMap[en] ?? en });

  const [subTab, setSubTab] = useState<"agents" | "departments">("agents");
  const [search, setSearch] = useState("");
  const [deptTab, setDeptTab] = useState("all");
  const [modalAgent, setModalAgent] = useState<Agent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deptOrder, setDeptOrder] = useState<Department[]>([]);
  const [deptOrderDirty, setDeptOrderDirty] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [draggingDeptId, setDraggingDeptId] = useState<string | null>(null);
  const [dragOverDeptId, setDragOverDeptId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);

  useEffect(() => {
    setDeptOrder([...departments].sort((a, b) => a.sort_order - b.sort_order));
    setDeptOrderDirty(false);
    setDraggingDeptId(null);
    setDragOverDeptId(null);
    setDragOverPosition(null);
  }, [departments]);

  const spriteMap = buildSpriteMap(agents);
  const randomIconSprites = useMemo(
    () => ({
      tab: pickRandomSpritePair(ICON_SPRITE_POOL),
      total: pickRandomSpritePair(ICON_SPRITE_POOL),
    }),
    [],
  );

  const filteredAgents = useMemo(
    () =>
      agents.filter((agent) => {
        if (deptTab !== "all" && agent.department_id !== deptTab) return false;
        if (!search) return true;
        const query = search.toLowerCase();
        return (
          agent.name.toLowerCase().includes(query) ||
          agent.name_ko.toLowerCase().includes(query) ||
          (agent.name_ja || "").toLowerCase().includes(query) ||
          (agent.name_zh || "").toLowerCase().includes(query)
        );
      }),
    [agents, deptTab, search],
  );

  const sortedAgents = useMemo(() => {
    const roleOrder: Record<string, number> = { team_leader: 0, senior: 1, junior: 2, intern: 3 };
    return [...filteredAgents].sort(
      (a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) || a.name.localeCompare(b.name),
    );
  }, [filteredAgents]);

  const openCreate = useCallback(() => {
    setModalAgent(null);
    setForm({ ...BLANK, department_id: deptTab !== "all" ? deptTab : departments[0]?.id || "" });
    setShowModal(true);
  }, [deptTab, departments]);

  const openEdit = useCallback(
    (agent: Agent) => {
      setModalAgent(agent);
      const computed = agent.sprite_number ?? buildSpriteMap(agents).get(agent.id) ?? null;
      setForm({
        name: agent.name,
        name_ko: agent.name_ko,
        name_ja: agent.name_ja || "",
        name_zh: agent.name_zh || "",
        department_id: agent.department_id || "",
        role: agent.role,
        cli_provider: agent.cli_provider,
        avatar_emoji: agent.avatar_emoji,
        sprite_number: computed,
        personality: agent.personality || "",
      });
      setShowModal(true);
    },
    [agents],
  );

  const closeModal = useCallback(() => {
    setShowModal(false);
    setModalAgent(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const departmentId = form.department_id.trim();
      const basePayload = {
        name: form.name.trim(),
        name_ko: form.name_ko.trim(),
        name_ja: form.name_ja.trim(),
        name_zh: form.name_zh.trim(),
        role: form.role,
        cli_provider: form.cli_provider,
        avatar_emoji: form.avatar_emoji || "🤖",
        sprite_number: form.sprite_number,
        personality: form.personality.trim() || null,
      };
      if (modalAgent) {
        await api.updateAgent(modalAgent.id, {
          ...basePayload,
          department_id: departmentId || null,
        });
      } else {
        await api.createAgent({
          ...basePayload,
          department_id: departmentId || null,
        });
      }
      onAgentsChange();
      closeModal();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [closeModal, form, modalAgent, onAgentsChange]);

  const handleDelete = useCallback(
    async (id: string) => {
      setSaving(true);
      try {
        await api.deleteAgent(id);
        onAgentsChange();
        setConfirmDeleteId(null);
        if (modalAgent?.id === id) closeModal();
      } catch (err) {
        console.error("Delete failed:", err);
      } finally {
        setSaving(false);
      }
    },
    [closeModal, modalAgent, onAgentsChange],
  );

  const openCreateDept = useCallback(() => {
    setEditDept(null);
    setShowDeptModal(true);
  }, []);

  const openEditDept = useCallback((department: Department) => {
    setEditDept(department);
    setShowDeptModal(true);
  }, []);

  const closeDeptModal = useCallback(() => {
    setShowDeptModal(false);
    setEditDept(null);
  }, []);

  const moveDept = useCallback(
    (index: number, direction: -1 | 1) => {
      const nextOrder = [...deptOrder];
      const target = index + direction;
      if (target < 0 || target >= nextOrder.length) return;
      [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
      setDeptOrder(nextOrder);
      setDeptOrderDirty(true);
    },
    [deptOrder],
  );

  const getDropPosition = useCallback((event: DragEvent<HTMLDivElement>): "before" | "after" => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }, []);

  const clearDeptDragState = useCallback(() => {
    setDraggingDeptId(null);
    setDragOverDeptId(null);
    setDragOverPosition(null);
  }, []);

  const moveDeptByDrag = useCallback(
    (dragDeptId: string, targetDeptId: string, position: "before" | "after") => {
      if (dragDeptId === targetDeptId) return;
      const fromIndex = deptOrder.findIndex((department) => department.id === dragDeptId);
      const targetIndex = deptOrder.findIndex((department) => department.id === targetDeptId);
      if (fromIndex < 0 || targetIndex < 0) return;

      const nextOrder = [...deptOrder];
      const [dragged] = nextOrder.splice(fromIndex, 1);
      let insertIndex = targetIndex + (position === "after" ? 1 : 0);
      if (fromIndex < insertIndex) insertIndex -= 1;
      insertIndex = Math.max(0, Math.min(insertIndex, nextOrder.length));
      nextOrder.splice(insertIndex, 0, dragged);

      const changed = nextOrder.some((department, i) => department.id !== deptOrder[i]?.id);
      if (!changed) return;
      setDeptOrder(nextOrder);
      setDeptOrderDirty(true);
    },
    [deptOrder],
  );

  const saveDeptOrder = useCallback(async () => {
    setReorderSaving(true);
    try {
      const orders = deptOrder.map((department, index) => ({ id: department.id, sort_order: index + 1 }));
      await api.reorderDepartments(orders);
      setDeptOrderDirty(false);
      onAgentsChange();
    } catch (err) {
      console.error("Reorder failed:", err);
    } finally {
      setReorderSaving(false);
    }
  }, [deptOrder, onAgentsChange]);

  const resetDeptOrder = useCallback(() => {
    setDeptOrder([...departments].sort((a, b) => a.sort_order - b.sort_order));
    setDeptOrderDirty(false);
  }, [departments]);

  const handleDeptDragStart = useCallback((deptId: string, event: DragEvent<HTMLDivElement>) => {
    setDraggingDeptId(deptId);
    setDragOverDeptId(null);
    setDragOverPosition(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", deptId);
  }, []);

  const handleDeptDragOver = useCallback(
    (deptId: string, event: DragEvent<HTMLDivElement>) => {
      if (!draggingDeptId || draggingDeptId === deptId) return;
      event.preventDefault();
      const nextPosition = getDropPosition(event);
      if (dragOverDeptId !== deptId || dragOverPosition !== nextPosition) {
        setDragOverDeptId(deptId);
        setDragOverPosition(nextPosition);
      }
      event.dataTransfer.dropEffect = "move";
    },
    [dragOverDeptId, dragOverPosition, draggingDeptId, getDropPosition],
  );

  const handleDeptDrop = useCallback(
    (deptId: string, event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const droppedId = event.dataTransfer.getData("text/plain") || draggingDeptId;
      if (droppedId && droppedId !== deptId) {
        moveDeptByDrag(droppedId, deptId, getDropPosition(event));
      }
      clearDeptDragState();
    },
    [clearDeptDragState, draggingDeptId, getDropPosition, moveDeptByDrag],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--th-text-heading)" }}>
          <span className="relative inline-flex items-center" style={{ width: 30, height: 22 }}>
            <img
              src="/sprites/8-D-1.png"
              alt=""
              className="absolute left-0 top-0 w-5 h-5 rounded-full object-cover"
              style={{ imageRendering: "pixelated", opacity: 0.85 }}
            />
            <img
              src="/sprites/3-D-1.png"
              alt=""
              className="absolute left-2.5 top-0.5 w-5 h-5 rounded-full object-cover"
              style={{ imageRendering: "pixelated", zIndex: 1 }}
            />
          </span>
          {tr("직원 관리", "Agent Manager", "Gestor de agentes")}
        </h2>
        <div className="flex items-center gap-2">
          {subTab === "agents" && (
            <>
              <button
                onClick={openCreateDept}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:opacity-80 shadow-sm"
                style={{ background: "#7c3aed", color: "#ffffff", boxShadow: "0 1px 3px rgba(124,58,237,0.3)" }}
              >
                + {tr("부서 추가", "Add Dept", "Agregar depto")}
              </button>
              <button
                onClick={openCreate}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm shadow-blue-600/20"
              >
                + {tr("신규 채용", "Hire Agent", "Contratar agente")}
              </button>
            </>
          )}
          {subTab === "departments" && (
            <button
              onClick={openCreateDept}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:opacity-80 shadow-sm"
              style={{ background: "#7c3aed", color: "#ffffff", boxShadow: "0 1px 3px rgba(124,58,237,0.3)" }}
            >
              + {tr("부서 추가", "Add Dept", "Agregar depto")}
            </button>
          )}
        </div>
      </div>

      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
      >
        {[
          {
            key: "agents" as const,
            label: tr("직원관리", "Agents", "Agentes"),
            icon: <StackedSpriteIcon sprites={randomIconSprites.tab} />,
          },
          { key: "departments" as const, label: tr("부서관리", "Departments", "Departamentos"), icon: "🏢" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "hover:bg-white/5"
            }`}
            style={subTab !== tab.key ? { color: "var(--th-text-muted)" } : undefined}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === "agents" && (
        <AgentsTab
          tr={tr}
          locale={locale}
          isKo={isKo}
          agents={agents}
          departments={departments}
          deptTab={deptTab}
          setDeptTab={setDeptTab}
          search={search}
          setSearch={setSearch}
          sortedAgents={sortedAgents}
          spriteMap={spriteMap}
          confirmDeleteId={confirmDeleteId}
          setConfirmDeleteId={setConfirmDeleteId}
          onEditAgent={openEdit}
          onEditDepartment={openEditDept}
          onDeleteAgent={handleDelete}
          saving={saving}
          randomIconSprites={{ total: randomIconSprites.total }}
        />
      )}

      {subTab === "departments" && (
        <DepartmentsTab
          tr={tr}
          locale={locale}
          agents={agents}
          departments={departments}
          deptOrder={deptOrder}
          deptOrderDirty={deptOrderDirty}
          reorderSaving={reorderSaving}
          draggingDeptId={draggingDeptId}
          dragOverDeptId={dragOverDeptId}
          dragOverPosition={dragOverPosition}
          onSaveOrder={saveDeptOrder}
          onCancelOrder={resetDeptOrder}
          onMoveDept={moveDept}
          onEditDept={openEditDept}
          onDragStart={handleDeptDragStart}
          onDragOver={handleDeptDragOver}
          onDrop={handleDeptDrop}
          onDragEnd={clearDeptDragState}
        />
      )}

      {showModal && (
        <AgentFormModal
          isKo={isKo}
          locale={locale}
          tr={tr}
          form={form}
          setForm={setForm}
          departments={departments}
          isEdit={!!modalAgent}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {showDeptModal && (
        <DepartmentFormModal
          locale={locale}
          tr={tr}
          department={editDept}
          departments={departments}
          onSave={onAgentsChange}
          onClose={closeDeptModal}
        />
      )}
    </div>
  );
}
