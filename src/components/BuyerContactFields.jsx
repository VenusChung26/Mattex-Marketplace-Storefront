import { AccountField } from "./AccountForm";
import { PHONE_REGIONS } from "../lib/phone";

export function BuyerContactFields({ t, value, onChange, errors = {} }) {
  const roles = Array.isArray(value.roles) ? value.roles : [];

  function toggleRole(role) {
    const next = roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role];
    onChange("roles", next);
  }

  return (
    <>
      <AccountField label={t("mobilePhone")} required error={errors.phone}>
        <div className="flex gap-2">
          <select
            className="field-input max-w-[11rem]"
            value={value.phoneRegion || "852"}
            onChange={(e) => onChange("phoneRegion", e.target.value)}
            aria-label={t("phoneRegion")}
          >
            {PHONE_REGIONS.map((region) => (
              <option key={region.id} value={region.id}>
                {region.label}
              </option>
            ))}
          </select>
          {value.phoneRegion === "other" ? (
            <input
              type="text"
              inputMode="numeric"
              className="field-input max-w-[5.5rem]"
              value={value.phoneOtherCode || ""}
              onChange={(e) => onChange("phoneOtherCode", e.target.value)}
              placeholder="+Code"
              aria-label={t("phoneRegion")}
            />
          ) : null}
          <input
            type="tel"
            value={value.phoneNational || ""}
            onChange={(e) => onChange("phoneNational", e.target.value)}
            placeholder={t("phMobilePhone")}
            className="field-input"
            autoComplete="tel-national"
          />
        </div>
      </AccountField>
      <AccountField label={t("wechat")}>
        <input
          type="text"
          value={value.wechat || ""}
          onChange={(e) => onChange("wechat", e.target.value)}
          className="field-input"
          autoComplete="off"
        />
      </AccountField>
      <AccountField label={t("accountRoles")} required error={errors.roles}>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={roles.includes("contractor")} onChange={() => toggleRole("contractor")} />
            {t("roleContractor")}
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={roles.includes("buyer")} onChange={() => toggleRole("buyer")} />
            {t("roleBuyer")}
          </label>
        </div>
      </AccountField>
    </>
  );
}
