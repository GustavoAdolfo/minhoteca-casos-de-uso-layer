import {
  EditoraDTO,
  EditoraAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class AlterarEditoraUseCase implements UseCaseInterface {
  private _tableName: string;
  private logService = new LogService('AlterarEditoraUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tableName = process.env.EDITORA_TABLE_NAME || 'Editoras';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info('Início a execução do caso de uso AlterarEditoraUseCase', {}, { data });
    try {
      const dto = JSON.parse(data.body ?? '{}') as EditoraDTO;
      if (!dto.id || dto.id.trim() === '') {
        this.logService.error('ID da editora é obrigatório para alteração.');
        throw new Error('ID da editora é obrigatório para alteração.');
      }

      const entity = EditoraAdapter.fromCreateDTO(dto);

      const result = await this._repository.updateByMinhotecaId(
        this._tableName,
        JSON.parse(entity.toJSONString()),
        dto.id
      );

      return createResult(result.data, 200, 'Editora alterada com sucesso');
    } catch (error) {
      this.logService.error('Erro ao alterar editora:', {}, error as Error);
      throw new Error('Falha ao alterar editora.', { cause: error });
    }
  }
}
