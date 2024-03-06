/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
import sendRequest from "services";
import endpoints from "utilities/endpoints";
import { IHost, HostStatus } from "interfaces/host";
import {
  buildQueryStringFromParams,
  getLabelParam,
  reconcileMutuallyExclusiveHostParams,
  reconcileMutuallyInclusiveHostParams,
} from "utilities/url";
import { SelectedPlatform } from "interfaces/platform";
import { ISoftwareTitle, ISoftware } from "interfaces/software";
import {
  DiskEncryptionStatus,
  BootstrapPackageStatus,
  IMdmSolution,
  MdmProfileStatus,
} from "interfaces/mdm";
import { IMunkiIssuesAggregate } from "interfaces/macadmins";

export interface ISortOption {
  key: string;
  direction: string;
}

export interface ILoadHostsResponse {
  hosts: IHost[];
  software: ISoftware | undefined;
  software_title: ISoftwareTitle | undefined;
  munki_issue: IMunkiIssuesAggregate;
  mobile_device_management_solution: IMdmSolution;
}

export type IUnlockHostResponse =
  | {
      host_id: number;
      unlock_pin: string;
    }
  | Record<string, never>;

// the source of truth for the filter option names.
// there are used on many other pages but we define them here.
// TODO: add other filter options here.
export const HOSTS_QUERY_PARAMS = {
  OS_SETTINGS: "os_settings",
  DISK_ENCRYPTION: "os_settings_disk_encryption",
} as const;

export interface ILoadHostsQueryKey extends IPaginateHostOptions {
  scope: "hosts";
}

export type MacSettingsStatusQueryParam = "latest" | "pending" | "failing";

/** For organization purposes, order matches rest-api.md > List hosts parameters
and all code added should follow suit */
export interface IBaseHostsOptions {
  status?: HostStatus;
  globalFilter?: string;
  teamId?: number;
  policyId?: number;
  policyResponse?: string;
  softwareId?: number;
  softwareTitleId?: number;
  softwareVersionId?: number;
  selectedLabels?: string[];
  osName?: string;
  osVersionId?: number;
  osVersion?: string;
  vulnerability?: string;
  deviceMapping?: boolean;
  mdmId?: number;
  mdmEnrollmentStatus?: string;
  macSettingsStatus?: MacSettingsStatusQueryParam;
  munkiIssueId?: number;
  lowDiskSpaceHosts?: number;
  bootstrapPackageStatus?: BootstrapPackageStatus;
  osSettings?: MdmProfileStatus;
  diskEncryptionStatus?: DiskEncryptionStatus;
}

export interface IPaginateHostOptions extends IBaseHostsOptions {
  visibleColumns?: string;
  page?: number;
  perPage?: number;
  sortBy: ISortOption[];
}

export interface IActionByFilter {
  teamId: number | null;
  query: string;
  status: string;
  labelId?: number;
  currentTeam?: number | null;
}

export type ILoadHostDetailsExtension = "device_mapping" | "macadmins";

const LABEL_PREFIX = "labels/";

const getLabel = (selectedLabels?: string[]) => {
  if (selectedLabels === undefined) return undefined;
  return selectedLabels.find((filter) => filter.includes(LABEL_PREFIX));
};

const getHostEndpoint = (selectedLabels?: string[]) => {
  const { HOSTS, LABEL_HOSTS } = endpoints;
  if (selectedLabels === undefined) return HOSTS;

  const label = getLabel(selectedLabels);
  if (label) {
    const labelId = label.substr(LABEL_PREFIX.length);
    return LABEL_HOSTS(parseInt(labelId, 10));
  }

  return HOSTS;
};

const getSortParams = (sortOptions?: ISortOption[]) => {
  if (sortOptions === undefined || sortOptions.length === 0) {
    return {};
  }

  const sortItem = sortOptions[0];
  return {
    order_key: sortItem.key,
    order_direction: sortItem.direction,
  };
};

const createMdmParams = (platform?: SelectedPlatform, teamId?: number) => {
  if (platform === "all") {
    return buildQueryStringFromParams({ team_id: teamId });
  }

  return buildQueryStringFromParams({ platform, team_id: teamId });
};

export default {
  destroy: (host: IHost) => {
    const { HOSTS } = endpoints;
    const path = `${HOSTS}/${host.id}`;

    return sendRequest("DELETE", path);
  },
  destroyBulk: (hostIds: number[]) => {
    const { HOSTS_DELETE } = endpoints;

    return sendRequest("POST", HOSTS_DELETE, { ids: hostIds });
  },
  destroyByFilter: ({ teamId, query, status, labelId }: IActionByFilter) => {
    const { HOSTS_DELETE } = endpoints;
    return sendRequest("POST", HOSTS_DELETE, {
      filters: {
        query,
        status,
        label_id: labelId,
        team_id: teamId,
      },
    });
  },
  exportHosts: (options: IPaginateHostOptions) => {
    // Order matches rest-api.md > List hosts parameters
    const visibleColumns = options?.visibleColumns;
    const sortBy = options.sortBy;
    const status = options?.status;
    const globalFilter = options?.globalFilter || "";
    const teamId = options?.teamId;
    const policyId = options?.policyId;
    const policyResponse = options?.policyResponse || "passing";
    const softwareId = options?.softwareId;
    const softwareTitleId = options?.softwareTitleId;
    const softwareVersionId = options?.softwareVersionId;
    const label = getLabelParam(options?.selectedLabels || []);
    const osName = options?.osName;
    const osVersionId = options?.osVersionId;
    const osVersion = options?.osVersion;
    const vulnerability = options?.vulnerability;
    const mdmId = options?.mdmId;
    const mdmEnrollmentStatus = options?.mdmEnrollmentStatus;
    const macSettingsStatus = options?.macSettingsStatus;
    const munkiIssueId = options?.munkiIssueId;
    const lowDiskSpaceHosts = options?.lowDiskSpaceHosts;
    const bootstrapPackageStatus = options?.bootstrapPackageStatus;
    const osSettings = options?.osSettings;
    const diskEncryptionStatus = options?.diskEncryptionStatus;

    if (!sortBy.length) {
      throw Error("sortBy is a required field.");
    }

    const queryParams = {
      order_key: sortBy[0].key,
      order_direction: sortBy[0].direction,
      query: globalFilter,
      ...reconcileMutuallyInclusiveHostParams({
        label,
        teamId,
        macSettingsStatus,
        osSettings,
      }),
      ...reconcileMutuallyExclusiveHostParams({
        // Order matches rest-api.md > List hosts parameters
        policyId,
        policyResponse,
        softwareId,
        softwareTitleId,
        softwareVersionId,
        label,
        osName,
        osVersionId,
        osVersion,
        vulnerability,
        mdmId,
        mdmEnrollmentStatus,
        munkiIssueId,
        lowDiskSpaceHosts,
        bootstrapPackageStatus,
        diskEncryptionStatus,
        osSettings,
      }),
      status,
      label_id: label,
      columns: visibleColumns,
      format: "csv",
    };

    const queryString = buildQueryStringFromParams(queryParams);

    const endpoint = endpoints.HOSTS_REPORT;
    const path = `${endpoint}?${queryString}`;

    return sendRequest("GET", path);
  },
  loadHosts: ({
    // Order matches rest-api.md > List hosts parameters
    page = 0,
    perPage = 100,
    sortBy,
    status,
    globalFilter,
    teamId,
    policyId,
    policyResponse = "passing",
    softwareId,
    softwareTitleId,
    softwareVersionId,
    selectedLabels,
    osName,
    osVersionId,
    osVersion,
    vulnerability,
    deviceMapping,
    mdmId,
    mdmEnrollmentStatus,
    macSettingsStatus,
    munkiIssueId,
    lowDiskSpaceHosts,
    bootstrapPackageStatus,
    osSettings,
    diskEncryptionStatus,
  }: IPaginateHostOptions): Promise<ILoadHostsResponse> => {
    const label = getLabel(selectedLabels);
    const sortParams = getSortParams(sortBy);

    const queryParams = {
      page,
      per_page: perPage,
      query: globalFilter,
      device_mapping: deviceMapping,
      order_key: sortParams.order_key,
      order_direction: sortParams.order_direction,
      status,
      ...reconcileMutuallyInclusiveHostParams({
        label,
        teamId,
        macSettingsStatus,
        osSettings,
      }),
      ...reconcileMutuallyExclusiveHostParams({
        label,
        policyId,
        policyResponse,
        mdmId,
        mdmEnrollmentStatus,
        munkiIssueId,
        softwareId,
        softwareTitleId,
        softwareVersionId,
        lowDiskSpaceHosts,
        osVersionId,
        osName,
        osVersion,
        vulnerability,
        diskEncryptionStatus,
        osSettings,
        bootstrapPackageStatus,
      }),
    };

    const queryString = buildQueryStringFromParams(queryParams);

    const endpoint = getHostEndpoint(selectedLabels);
    const path = `${endpoint}?${queryString}`;
    return sendRequest("GET", path);
  },
  loadHostDetails: (hostID: number) => {
    const { HOSTS } = endpoints;
    const path = `${HOSTS}/${hostID}`;

    return sendRequest("GET", path);
  },
  loadHostDetailsExtension: (
    hostID: number,
    extension: ILoadHostDetailsExtension
  ) => {
    const { HOSTS } = endpoints;
    const path = `${HOSTS}/${hostID}/${extension}`;

    return sendRequest("GET", path);
  },
  refetch: (host: IHost) => {
    const { HOSTS } = endpoints;
    const path = `${HOSTS}/${host.id}/refetch`;

    return sendRequest("POST", path);
  },
  search: (searchText: string) => {
    const { HOSTS } = endpoints;
    const path = `${HOSTS}?query=${searchText}`;

    return sendRequest("GET", path);
  },
  transferToTeam: (teamId: number | null, hostIds: number[]) => {
    const { HOSTS_TRANSFER } = endpoints;

    return sendRequest("POST", HOSTS_TRANSFER, {
      team_id: teamId,
      hosts: hostIds,
    });
  },

  // TODO confirm interplay with policies
  transferToTeamByFilter: ({
    teamId,
    query,
    status,
    labelId,
    currentTeam,
  }: IActionByFilter) => {
    const { HOSTS_TRANSFER_BY_FILTER } = endpoints;
    return sendRequest("POST", HOSTS_TRANSFER_BY_FILTER, {
      team_id: teamId,
      filters: {
        query,
        status,
        label_id: labelId,
        team_id: currentTeam,
      },
    });
  },

  getMdm: (id: number) => {
    const { HOST_MDM } = endpoints;
    return sendRequest("GET", HOST_MDM(id));
  },

  getMdmSummary: (platform?: SelectedPlatform, teamId?: number) => {
    const { MDM_SUMMARY } = endpoints;

    if (!platform || platform === "linux") {
      throw new Error("mdm not supported for this platform");
    }

    const params = createMdmParams(platform, teamId);
    const fullPath = params !== "" ? `${MDM_SUMMARY}?${params}` : MDM_SUMMARY;
    return sendRequest("GET", fullPath);
  },

  getEncryptionKey: (id: number) => {
    const { HOST_ENCRYPTION_KEY } = endpoints;
    return sendRequest("GET", HOST_ENCRYPTION_KEY(id));
  },

  lockHost: (id: number) => {
    const { HOST_LOCK } = endpoints;
    return sendRequest("POST", HOST_LOCK(id));
  },

  unlockHost: (id: number): Promise<IUnlockHostResponse> => {
    const { HOST_UNLOCK } = endpoints;
    return sendRequest("POST", HOST_UNLOCK(id));
  },

  wipeHost: (id: number) => {
    const { HOST_WIPE } = endpoints;
    return sendRequest("POST", HOST_WIPE(id));
  },
};
