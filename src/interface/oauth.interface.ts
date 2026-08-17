export interface IOAuthCheck_auth_info {
  auth: number;
  userId: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    patronymic: string;
    fullName: string;
    initials: string;
    photoUrl: string;
    birthday: string;
    login: string;
    email: string;
    groupName?: string;
  };
}
